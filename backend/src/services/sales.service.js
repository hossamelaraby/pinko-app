import { getDb } from '../db/index.js';
import { InventoryService } from './inventory.service.js';

export class SalesService {
  /**
   * Process and commit POS Sale atomically
   * Invariants: I4 (Totals match), I5 (Cash drawer), I6 (Customer debt), I9 (Idempotency), I10 (Atomicity), I11 (Concurrency)
   */
  static async commitSale({
    businessId,
    locationId,
    cashierId,
    shiftId,
    customerId,
    items, // [{ productId, unit, quantity, unitPricePiastres }]
    discountPiastres = 0,
    paidCashPiastres = 0,
    paidCardPiastres = 0,
    idempotencyKey,
    notes
  }) {
    if (!idempotencyKey) {
      throw new Error('مفتاح عدم التكرار (Idempotency Key) مطلوب لكل عملية بيع');
    }

    const db = getDb();

    // Check idempotency first
    const existingKey = await db.query(
      `SELECT * FROM idempotency_keys WHERE key = $1 AND business_id = $2`,
      [idempotencyKey, businessId]
    );
    if (existingKey.rows.length > 0) {
      return JSON.parse(existingKey.rows[0].response_json);
    }

    return await db.transaction(async (client) => {
      // 1. Calculate and verify totals server-side (Never trust client totals)
      let subtotalPiastres = 0;
      const verifiedItems = [];

      for (const item of items) {
        // Fetch product
        const prodRes = await client.query(
          `SELECT * FROM products WHERE id = $1 AND business_id = $2 AND is_active = TRUE`,
          [item.productId, businessId]
        );
        if (prodRes.rows.length === 0) {
          throw new Error(`المنتج غير موجود أو غير نشط: ${item.productId}`);
        }
        const product = prodRes.rows[0];

        const quantityBase = InventoryService.toBaseQuantity(
          item.quantity,
          item.unit,
          product.box_ratio,
          product.carton_ratio
        );

        const lineTotalPiastres = item.quantity * item.unitPricePiastres;
        subtotalPiastres += lineTotalPiastres;

        verifiedItems.push({
          productId: product.id,
          unit: item.unit,
          quantity: item.quantity,
          quantityBase,
          unitPricePiastres: item.unitPricePiastres,
          totalPricePiastres: lineTotalPiastres
        });
      }

      if (discountPiastres < 0 || discountPiastres > subtotalPiastres) {
        throw new Error('قيمة الخصم غير صالحة');
      }

      const totalPiastres = subtotalPiastres - discountPiastres;
      const totalPaid = paidCashPiastres + paidCardPiastres;

      if (totalPaid > totalPiastres) {
        throw new Error('المبلغ المدفوع يتجاوز إجمالي الفاتورة');
      }

      const onCreditPiastres = totalPiastres - totalPaid;

      // Credit sale requires valid customer
      if (onCreditPiastres > 0 && !customerId) {
        throw new Error('البيع بالآجل يتطلب تحديد العميل');
      }

      // Check customer credit limit if applicable
      if (onCreditPiastres > 0 && customerId) {
        const custRes = await client.query(
          `SELECT * FROM customers WHERE id = $1 AND business_id = $2`,
          [customerId, businessId]
        );
        if (custRes.rows.length === 0) throw new Error('العميل غير موجود');
        const customer = custRes.rows[0];

        const debtRes = await client.query(
          `SELECT COALESCE(SUM(amount_piastres), 0)::BIGINT as current_debt 
           FROM customer_ledger WHERE customer_id = $1 AND business_id = $2`,
          [customerId, businessId]
        );
        const currentDebt = parseInt(debtRes.rows[0].current_debt, 10);
        if (customer.credit_limit_piastres > 0 && (currentDebt + onCreditPiastres) > customer.credit_limit_piastres) {
          throw new Error('العملية تتجاوز الحد الائتماني المسموح به للعميل');
        }
      }

      const invoiceNumber = `INV-${Date.now()}`;

      // 2. Insert Sale Header
      const saleRes = await client.query(
        `INSERT INTO sales (
          business_id, invoice_number, location_id, shift_id, customer_id, cashier_id,
          subtotal_piastres, discount_piastres, total_piastres,
          paid_cash_piastres, paid_card_piastres, on_credit_piastres,
          status, notes, idempotency_key
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'completed', $13, $14
        ) RETURNING *`,
        [
          businessId, invoiceNumber, locationId, shiftId, customerId, cashierId,
          subtotalPiastres, discountPiastres, totalPiastres,
          paidCashPiastres, paidCardPiastres, onCreditPiastres,
          notes, idempotencyKey
        ]
      );
      const sale = saleRes.rows[0];

      // 3. Insert Sale Lines & Deduct Stock Atomically
      for (const item of verifiedItems) {
        await client.query(
          `INSERT INTO sale_items (
            sale_id, product_id, unit, quantity, quantity_base, unit_price_piastres, total_price_piastres
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            sale.id, item.productId, item.unit, item.quantity, item.quantityBase,
            item.unitPricePiastres, item.totalPricePiastres
          ]
        );

        // Deduct inventory
        await InventoryService.recordStockMovement({
          businessId,
          productId: item.productId,
          locationId,
          movementType: 'sale',
          quantityBase: -item.quantityBase,
          referenceId: sale.id,
          actorId: cashierId,
          reason: `فاتورة مبيعات ${invoiceNumber}`
        });
      }

      // 4. Update Cash Drawer if paid cash and shift open
      if (paidCashPiastres > 0 && shiftId) {
        await client.query(
          `INSERT INTO cash_movements (
            shift_id, movement_type, amount_piastres, reference_id, actor_id, reason
          ) VALUES ($1, 'sale_cash', $2, $3, $4, $5)`,
          [shiftId, paidCashPiastres, sale.id, cashierId, `تحصيل نقدي فاتورة ${invoiceNumber}`]
        );
      }

      // 5. Update Customer Ledger if on credit
      if (onCreditPiastres > 0) {
        await client.query(
          `INSERT INTO customer_ledger (
            business_id, customer_id, entry_type, amount_piastres, reference_id, actor_id, notes
          ) VALUES ($1, $2, 'credit_sale', $3, $4, $5, $6)`,
          [businessId, customerId, onCreditPiastres, sale.id, cashierId, `مبيعات آجلة فاتورة ${invoiceNumber}`]
        );
      }

      // 6. Record Audit Log
      await client.query(
        `INSERT INTO audit_logs (
          business_id, actor_id, role, location_id, server_transaction_id,
          action_type, entity_name, entity_id, details_json
        ) VALUES ($1, $2, 'cashier', $3, $4, 'CREATE_SALE', 'sales', $5, $6)`,
        [businessId, cashierId, locationId, sale.id, sale.id, JSON.stringify({ invoiceNumber, totalPiastres })]
      );

      // 7. Save Idempotency response
      await client.query(
        `INSERT INTO idempotency_keys (key, business_id, endpoint, request_hash, response_status, response_json)
         VALUES ($1, $2, '/api/sales', 'hash', 200, $3)`,
        [idempotencyKey, businessId, JSON.stringify(sale)]
      );

      return sale;
    });
  }

  /**
   * Process Customer Debt Collection
   * Invariant I5 & I6
   */
  static async collectDebt({
    businessId,
    customerId,
    collectorId,
    shiftId,
    amountPiastres,
    paymentMethod = 'cash',
    notes
  }) {
    if (amountPiastres <= 0) throw new Error('مبلغ التحصيل يجب أن يكون أكبر من صفر');

    const db = getDb();
    return await db.transaction(async (client) => {
      // 1. Check customer debt
      const debtRes = await client.query(
        `SELECT COALESCE(SUM(amount_piastres), 0)::BIGINT as current_debt 
         FROM customer_ledger WHERE customer_id = $1 AND business_id = $2`,
        [customerId, businessId]
      );
      const currentDebt = parseInt(debtRes.rows[0].current_debt, 10);
      if (amountPiastres > currentDebt) {
        throw new Error('مبلغ السداد يتجاوز إجمالي الدين المستحق على العميل');
      }

      const receiptNumber = `REC-${Date.now()}`;

      // 2. Insert into customer ledger (negative amount reduces debt)
      const ledgerRes = await client.query(
        `INSERT INTO customer_ledger (
          business_id, customer_id, entry_type, amount_piastres, reference_id, actor_id, notes
        ) VALUES ($1, $2, 'collection', $3, $4, $5, $6) RETURNING *`,
        [businessId, customerId, -amountPiastres, receiptNumber, collectorId, notes]
      );

      // 3. Record cash movement if cash
      if (paymentMethod === 'cash' && shiftId) {
        await client.query(
          `INSERT INTO cash_movements (
            shift_id, movement_type, amount_piastres, reference_id, actor_id, reason
          ) VALUES ($1, 'debt_collection', $2, $3, $4, $5)`,
          [shiftId, amountPiastres, receiptNumber, collectorId, `تحصيل مديونية إيصال ${receiptNumber}`]
        );
      }

      return {
        receiptNumber,
        amountPiastres,
        remainingDebt: currentDebt - amountPiastres
      };
    });
  }
}
