import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/db/index.js';
import { seedInitialData } from '../src/db/seed.js';
import { InventoryService } from '../src/services/inventory.service.js';
import { TransferService } from '../src/services/transfer.service.js';
import { SalesService } from '../src/services/sales.service.js';
import { VehicleRouteService } from '../src/services/vehicle.service.js';

test('Pinko App Invariants & Security Suite', async (t) => {
  const db = getDb();
  const seed = await seedInitialData();

  await t.test('I1: Stock by location reconciles exactly with immutable ledger', async () => {
    const { businessId, locations, products, users } = seed;
    const shop1 = locations.shop1;
    const prod = products.choc;
    const owner = users.owner;

    // Post an initial receiving movement: 10 cartons (1440 pieces)
    await InventoryService.recordStockMovement({
      businessId,
      productId: prod,
      locationId: shop1,
      movementType: 'receipt',
      quantityBase: 1440,
      referenceId: 'PO-001',
      actorId: owner,
      reason: 'توريد أولي للمحل 1'
    });

    const reconciliation = await InventoryService.reconcileStockLedger(businessId, prod, shop1);
    assert.equal(reconciliation.isReconciled, true);
    assert.equal(reconciliation.ledgerSum, 1440);
    assert.equal(reconciliation.projSum, 1440);
  });

  await t.test('I2: Transfer Conservation (Draft -> Dispatched -> Received)', async () => {
    const { businessId, locations, products, users } = seed;
    const sourceLoc = locations.shop1;
    const destLoc = locations.shop2;
    const prod = products.choc;
    const worker = users.abdelrahman;

    // Create Draft transfer of 2 cartons (288 pieces)
    const draft = await TransferService.createDraftTransfer({
      businessId,
      sourceLocationId: sourceLoc,
      destinationLocationId: destLoc,
      items: [{ productId: prod, quantityBase: 288 }],
      notes: 'تحويل بضاعة من المحل 1 إلى المحل 2',
      actorId: worker
    });
    assert.equal(draft.status, 'draft');

    // Source balance before dispatch must still be 1440
    let recSource = await InventoryService.reconcileStockLedger(businessId, prod, sourceLoc);
    assert.equal(recSource.projSum, 1440);

    // Dispatch transfer
    const dispatched = await TransferService.dispatchTransfer({
      businessId,
      transferId: draft.id,
      actorId: worker
    });
    assert.equal(dispatched.status, 'dispatched');

    // Source balance must now be 1440 - 288 = 1152
    recSource = await InventoryService.reconcileStockLedger(businessId, prod, sourceLoc);
    assert.equal(recSource.projSum, 1152);

    // Destination balance before receipt must still be 0
    let recDest = await InventoryService.reconcileStockLedger(businessId, prod, destLoc);
    assert.equal(recDest.projSum, 0);

    // Receive transfer: 280 accepted, 8 damaged
    const received = await TransferService.receiveTransfer({
      businessId,
      transferId: draft.id,
      receivedAllocations: [{
        productId: prod,
        receivedQtyBase: 280,
        damagedQtyBase: 8,
        notes: 'تم استلام 280 قطعة مع 8 قطع تالفة'
      }],
      actorId: worker
    });
    assert.equal(received.status, 'received');

    // Destination balance must now be exactly 280
    recDest = await InventoryService.reconcileStockLedger(businessId, prod, destLoc);
    assert.equal(recDest.projSum, 280);

    // Total conservation: Source (1152) + Destination (280) + Damaged (8) = Original 1440
    assert.equal(1152 + 280 + 8, 1440);
  });

  await t.test('I4 & I9: POS Sale Totals & Idempotency Replay', async () => {
    const { businessId, locations, products, users } = seed;
    const shop1 = locations.shop1;
    const prod = products.choc;
    const cashier = users.hanaa;

    const idempotencyKey = 'sale-idem-key-test-01';

    // Sell 12 pieces @ 10 EGP (1000 piastres each) = 120 EGP (12,000 piastres)
    // Paid 70 EGP cash (7,000 piastres), 50 EGP card (5,000 piastres)
    const sale1 = await SalesService.commitSale({
      businessId,
      locationId: shop1,
      cashierId: cashier,
      customerId: null,
      items: [{
        productId: prod,
        unit: 'piece',
        quantity: 12,
        unitPricePiastres: 1000
      }],
      discountPiastres: 0,
      paidCashPiastres: 7000,
      paidCardPiastres: 5000,
      idempotencyKey,
      notes: 'تجربة بيع بالكامل'
    });

    assert.equal(sale1.total_piastres, 12000);
    assert.equal(sale1.paid_cash_piastres, 7000);
    assert.equal(sale1.paid_card_piastres, 5000);
    assert.equal(sale1.on_credit_piastres, 0);

    // Replaying with identical idempotency key must return the exact same record without double deducting stock
    const balanceBeforeReplay = (await InventoryService.reconcileStockLedger(businessId, prod, shop1)).projSum;

    const saleReplay = await SalesService.commitSale({
      businessId,
      locationId: shop1,
      cashierId: cashier,
      customerId: null,
      items: [{
        productId: prod,
        unit: 'piece',
        quantity: 12,
        unitPricePiastres: 1000
      }],
      discountPiastres: 0,
      paidCashPiastres: 7000,
      paidCardPiastres: 5000,
      idempotencyKey,
      notes: 'إعادة إرسال مكررة لنفس العملية'
    });

    assert.equal(saleReplay.id, sale1.id);
    const balanceAfterReplay = (await InventoryService.reconcileStockLedger(businessId, prod, shop1)).projSum;
    assert.equal(balanceBeforeReplay, balanceAfterReplay);
  });

  await t.test('I6: Customer Credit Sales & Collections Reconciliation', async () => {
    const { businessId, locations, products, users, customers } = seed;
    const shop1 = locations.shop1;
    const prod = products.choc;
    const cashier = users.hanaa;
    const customer = customers.amana;

    // Sell 20 pieces @ 10 EGP = 200 EGP (20,000 piastres)
    // Paid 50 EGP cash (5,000 piastres), on credit: 150 EGP (15,000 piastres)
    const saleCredit = await SalesService.commitSale({
      businessId,
      locationId: shop1,
      cashierId: cashier,
      customerId: customer,
      items: [{
        productId: prod,
        unit: 'piece',
        quantity: 20,
        unitPricePiastres: 1000
      }],
      discountPiastres: 0,
      paidCashPiastres: 5000,
      paidCardPiastres: 0,
      idempotencyKey: 'sale-credit-key-01',
      notes: 'بيع بالآجل'
    });

    assert.equal(saleCredit.on_credit_piastres, 15000);

    // Check customer debt: must be 15,000 piastres
    const debtRes = await db.query(
      `SELECT COALESCE(SUM(amount_piastres), 0)::BIGINT as debt 
       FROM customer_ledger WHERE customer_id = $1`,
      [customer]
    );
    assert.equal(parseInt(debtRes.rows[0].debt, 10), 15000);

    // Make partial collection of 100 EGP (10,000 piastres)
    const collection = await SalesService.collectDebt({
      businessId,
      customerId: customer,
      collectorId: cashier,
      amountPiastres: 10000,
      notes: 'سداد دفعة نقدية'
    });

    assert.equal(collection.remainingDebt, 5000);

    // Check remaining customer debt in ledger: must be exactly 5,000 piastres
    const updatedDebtRes = await db.query(
      `SELECT COALESCE(SUM(amount_piastres), 0)::BIGINT as debt 
       FROM customer_ledger WHERE customer_id = $1`,
      [customer]
    );
    assert.equal(parseInt(updatedDebtRes.rows[0].debt, 10), 5000);
  });

  await t.test('I11: Negative stock protection blocks overdraft', async () => {
    const { businessId, locations, products, users } = seed;
    const shop2 = locations.shop2;
    const prod = products.choc;
    const cashier = users.mohamed;

    // Current balance at shop2 is 280 pieces
    // Attempt to sell 500 pieces
    await assert.rejects(
      async () => {
        await SalesService.commitSale({
          businessId,
          locationId: shop2,
          cashierId: cashier,
          items: [{
            productId: prod,
            unit: 'piece',
            quantity: 500,
            unitPricePiastres: 1000
          }],
          paidCashPiastres: 500000,
          idempotencyKey: 'sale-overdraft-test',
          notes: 'محاولة بيع كمية غير متوفرة'
        });
      },
      (err) => {
        assert.equal(err.code, 'INSUFFICIENT_STOCK');
        return true;
      }
    );

    // Verify balance at shop2 remained exactly 280
    const recShop2 = await InventoryService.reconcileStockLedger(businessId, prod, shop2);
    assert.equal(recShop2.projSum, 280);
  });

  await t.test('I3: Ibrahim Vehicle Route Session & Cash Reconciliation', async () => {
    const { businessId, locations, products, users, customers } = seed;
    const vehicle = locations.vehicle;
    const prod = products.choc;
    const driver = users.ibrahim;
    const worker = users.abdelrahman;
    const customer = customers.amana;

    // Load 100 pieces from shop1 to vehicle
    const loadTransfer = await TransferService.createDraftTransfer({
      businessId,
      sourceLocationId: locations.shop1,
      destinationLocationId: vehicle,
      items: [{ productId: prod, quantityBase: 100 }],
      notes: 'تحميل سيارة إبراهيم',
      actorId: worker
    });
    await TransferService.dispatchTransfer({ businessId, transferId: loadTransfer.id, actorId: worker });
    await TransferService.receiveTransfer({
      businessId,
      transferId: loadTransfer.id,
      receivedAllocations: [{ productId: prod, receivedQtyBase: 100, damagedQtyBase: 0 }],
      actorId: driver
    });

    // Start route session
    const session = await VehicleRouteService.startRouteSession({
      businessId,
      driverId: driver,
      vehicleLocationId: vehicle,
      notes: 'خط سير المعادي وحلوان'
    });
    assert.equal(session.status, 'active');

    // Driver sells 30 pieces on route for 300 EGP (30,000 piastres) cash
    await SalesService.commitSale({
      businessId,
      locationId: vehicle,
      cashierId: driver,
      customerId: customer,
      items: [{
        productId: prod,
        unit: 'piece',
        quantity: 30,
        unitPricePiastres: 1000
      }],
      paidCashPiastres: 30000,
      idempotencyKey: 'driver-route-sale-01',
      notes: 'بيع خط سير'
    });

    // Close route with counted cash 30,000 piastres
    const closedSession = await VehicleRouteService.reconcileAndCloseRoute({
      businessId,
      sessionId: session.id,
      countedCashPiastres: 30000,
      driverId: driver,
      notes: 'إغلاق وردية خط السير بالكامل بدون عجز'
    });

    assert.equal(closedSession.status, 'closed');
    assert.equal(closedSession.expected_cash_piastres, 30000);
    assert.equal(closedSession.counted_cash_piastres, 30000);
    assert.equal(closedSession.cash_variance_piastres, 0);

    // Verify closing vehicle stock: 100 loaded - 30 sold = 70 remaining
    const recVehicle = await InventoryService.reconcileStockLedger(businessId, prod, vehicle);
    assert.equal(recVehicle.projSum, 70);
  });
});
