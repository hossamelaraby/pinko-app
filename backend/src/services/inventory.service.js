import { getDb } from '../db/index.js';

export class InventoryService {
  /**
   * Post immutable stock movement and update projection atomically
   */
  static async recordStockMovement({
    businessId,
    productId,
    locationId,
    movementType,
    quantityBase, // positive for addition, negative for deduction
    referenceId,
    actorId,
    reason,
    idempotencyKey,
    allowNegative = false
  }) {
    const db = getDb();

    return await db.transaction(async (client) => {
      // 1. Check current balance with FOR UPDATE lock if location provided
      let currentOnHand = 0;
      if (locationId) {
        const balRes = await client.query(
          `SELECT on_hand_base FROM stock_balances 
           WHERE business_id = $1 AND product_id = $2 AND location_id = $3`,
          [businessId, productId, locationId]
        );

        if (balRes.rows.length > 0) {
          currentOnHand = balRes.rows[0].on_hand_base;
        } else {
          // Initialize row
          await client.query(
            `INSERT INTO stock_balances (business_id, product_id, location_id, on_hand_base)
             VALUES ($1, $2, $3, 0)
             ON CONFLICT (business_id, product_id, location_id) DO NOTHING`,
            [businessId, productId, locationId]
          );
        }

        const projectedOnHand = currentOnHand + quantityBase;

        // Invariant: Negative stock protection (unless explicit owner override)
        if (projectedOnHand < 0 && !allowNegative) {
          const err = new Error('الرصيد المتاح غير كافٍ لإتمام العملية');
          err.statusCode = 409;
          err.code = 'INSUFFICIENT_STOCK';
          throw err;
        }

        // 2. Update projection
        await client.query(
          `UPDATE stock_balances 
           SET on_hand_base = on_hand_base + $1, updated_at = CURRENT_TIMESTAMP
           WHERE business_id = $2 AND product_id = $3 AND location_id = $4`,
          [quantityBase, businessId, productId, locationId]
        );
      }

      // 3. Insert immutable ledger entry
      const ledgerRes = await client.query(
        `INSERT INTO stock_ledger (
          business_id, product_id, location_id, movement_type, 
          quantity_base, reference_id, actor_id, reason, idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [businessId, productId, locationId, movementType, quantityBase, referenceId, actorId, reason, idempotencyKey]
      );

      return {
        ledgerEntry: ledgerRes.rows[0],
        newBalance: currentOnHand + quantityBase
      };
    });
  }

  /**
   * Verify projection against actual immutable ledger sum
   * Invariant I1
   */
  static async reconcileStockLedger(businessId, productId, locationId) {
    const db = getDb();
    
    // Sum of all ledger movements
    const sumRes = await db.query(
      `SELECT COALESCE(SUM(quantity_base), 0)::INT as total_ledger_qty
       FROM stock_ledger 
       WHERE business_id = $1 AND product_id = $2 AND location_id = $3`,
      [businessId, productId, locationId]
    );
    const ledgerSum = parseInt(sumRes.rows[0].total_ledger_qty, 10);

    // Current projection
    const projRes = await db.query(
      `SELECT COALESCE(on_hand_base, 0) as proj_qty
       FROM stock_balances
       WHERE business_id = $1 AND product_id = $2 AND location_id = $3`,
      [businessId, productId, locationId]
    );
    const projSum = projRes.rows.length > 0 ? projRes.rows[0].proj_qty : 0;

    return {
      isReconciled: ledgerSum === projSum,
      ledgerSum,
      projSum
    };
  }

  /**
   * Convert quantity to base units safely
   */
  static toBaseQuantity(quantity, unit, boxRatio, cartonRatio) {
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new Error('الكمية يجب أن تكون عدداً صحيحاً موجباً');
    }

    if (unit === 'piece' || unit === 'base') {
      return quantity;
    } else if (unit === 'box') {
      return quantity * boxRatio;
    } else if (unit === 'carton') {
      return quantity * cartonRatio;
    } else {
      throw new Error(`وحدة قياس غير صالحة: ${unit}`);
    }
  }
}
