import { getDb } from '../db/index.js';
import { InventoryService } from './inventory.service.js';

export class TransferService {
  /**
   * Create a Draft Transfer
   */
  static async createDraftTransfer({
    businessId,
    sourceLocationId,
    destinationLocationId,
    items, // [{ productId, quantityBase }]
    notes,
    actorId
  }) {
    if (sourceLocationId === destinationLocationId) {
      throw new Error('لا يمكن التحويل لنفس الموقع');
    }

    const db = getDb();
    const transferNumber = `TR-${Date.now()}`;

    return await db.transaction(async (client) => {
      const transRes = await client.query(
        `INSERT INTO transfers (
          business_id, transfer_number, source_location_id, destination_location_id, 
          status, notes
        ) VALUES ($1, $2, $3, $4, 'draft', $5) RETURNING *`,
        [businessId, transferNumber, sourceLocationId, destinationLocationId, notes]
      );
      const transfer = transRes.rows[0];

      for (const item of items) {
        await client.query(
          `INSERT INTO transfer_items (transfer_id, product_id, dispatched_qty_base)
           VALUES ($1, $2, $3)`,
          [transfer.id, item.productId, item.quantityBase]
        );
      }

      return transfer;
    });
  }

  /**
   * Dispatch Transfer (Atomic stock reduction at source, in-transit state)
   * Invariant I2
   */
  static async dispatchTransfer({ businessId, transferId, actorId }) {
    const db = getDb();

    return await db.transaction(async (client) => {
      // 1. Fetch transfer
      const trRes = await client.query(
        `SELECT * FROM transfers WHERE id = $1 AND business_id = $2`,
        [transferId, businessId]
      );
      if (trRes.rows.length === 0) throw new Error('أمر التحويل غير موجود');
      const transfer = trRes.rows[0];

      if (transfer.status !== 'draft') {
        throw new Error('لا يمكن إرسال أمر تحويل إلا إذا كان في حالة مسودة');
      }

      // 2. Fetch items
      const itemsRes = await client.query(
        `SELECT * FROM transfer_items WHERE transfer_id = $1`,
        [transferId]
      );

      // 3. Deduct from source location
      for (const item of itemsRes.rows) {
        await InventoryService.recordStockMovement({
          businessId,
          productId: item.product_id,
          locationId: transfer.source_location_id,
          movementType: 'transfer_dispatch',
          quantityBase: -item.dispatched_qty_base,
          referenceId: transferId,
          actorId,
          reason: `إرسال تحويل ${transfer.transfer_number}`
        });
      }

      // 4. Update transfer status
      const updatedRes = await client.query(
        `UPDATE transfers 
         SET status = 'dispatched', dispatched_by = $1, dispatched_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [actorId, transferId]
      );

      return updatedRes.rows[0];
    });
  }

  /**
   * Receive Transfer (Supports Full, Partial, and Damage allocations)
   * Invariant I2 & I3
   */
  static async receiveTransfer({
    businessId,
    transferId,
    receivedAllocations, // [{ productId, receivedQtyBase, damagedQtyBase, notes }]
    actorId
  }) {
    const db = getDb();

    return await db.transaction(async (client) => {
      const trRes = await client.query(
        `SELECT * FROM transfers WHERE id = $1 AND business_id = $2`,
        [transferId, businessId]
      );
      if (trRes.rows.length === 0) throw new Error('أمر التحويل غير موجود');
      const transfer = trRes.rows[0];

      if (transfer.status !== 'dispatched') {
        throw new Error('لا يمكن استلام تحويل لم يتم إرساله أولاً');
      }

      for (const alloc of receivedAllocations) {
        // Find transfer item
        const itemRes = await client.query(
          `SELECT * FROM transfer_items 
           WHERE transfer_id = $1 AND product_id = $2`,
          [transferId, alloc.productId]
        );
        if (itemRes.rows.length === 0) throw new Error('الصنف غير موجود في أمر التحويل');
        const item = itemRes.rows[0];

        const totalAccounted = alloc.receivedQtyBase + alloc.damagedQtyBase;
        if (totalAccounted > item.dispatched_qty_base) {
          throw new Error('الكميات المستلمة والتالفة تتجاوز الكمية المرسلة بالفعل');
        }

        // Update item line
        await client.query(
          `UPDATE transfer_items 
           SET received_qty_base = $1, damaged_qty_base = $2, notes = $3
           WHERE id = $4`,
          [alloc.receivedQtyBase, alloc.damagedQtyBase, alloc.notes, item.id]
        );

        // Add accepted stock to destination
        if (alloc.receivedQtyBase > 0) {
          await InventoryService.recordStockMovement({
            businessId,
            productId: alloc.productId,
            locationId: transfer.destination_location_id,
            movementType: 'transfer_receive',
            quantityBase: alloc.receivedQtyBase,
            referenceId: transferId,
            actorId,
            reason: `استلام تحويل ${transfer.transfer_number}`
          });
        }

        // Record damaged quantity if any (damage movement)
        if (alloc.damagedQtyBase > 0) {
          await InventoryService.recordStockMovement({
            businessId,
            productId: alloc.productId,
            locationId: null, // Scrapped / in-transit damage
            movementType: 'damage',
            quantityBase: -alloc.damagedQtyBase,
            referenceId: transferId,
            actorId,
            reason: `تلف أثناء نقل التحويل ${transfer.transfer_number}`
          });
        }
      }

      // Check if partially or fully received
      const finalItems = await client.query(
        `SELECT * FROM transfer_items WHERE transfer_id = $1`,
        [transferId]
      );
      let isPartial = false;
      for (const it of finalItems.rows) {
        if (it.received_qty_base + it.damaged_qty_base < it.dispatched_qty_base) {
          isPartial = true;
          break;
        }
      }

      const finalStatus = isPartial ? 'partial_received' : 'received';
      const updatedRes = await client.query(
        `UPDATE transfers 
         SET status = $1, received_by = $2, received_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`,
        [finalStatus, actorId, transferId]
      );

      return updatedRes.rows[0];
    });
  }
}
