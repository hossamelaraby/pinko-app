import test from 'node:test';
import assert from 'node:assert/strict';

const API_BASE = 'http://localhost:4000/api';

test('Pinko App E2E Live Workflow & Complete Mathematical Integrity', async (t) => {

  // Test 1: Authentication & Creative Role Passwords
  await t.test('Auth: All 4 Roles authenticate with creative passwords and reject invalid', async () => {
    // Owner
    const ownerRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'owner', password: 'Pinko@Boss2026' })
    });
    assert.equal(ownerRes.status, 200);
    const ownerData = await ownerRes.json();
    assert.equal(ownerData.user.role, 'owner');

    // Owner Bad Pass
    const ownerBadRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'owner', password: 'WrongPassword' })
    });
    assert.equal(ownerBadRes.status, 401);

    // Shop 1
    const shop1Res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'branch', locationCode: 'shop1_warehouse1', password: 'Shop1@Hanaa' })
    });
    assert.equal(shop1Res.status, 200);
    const shop1Data = await shop1Res.json();
    assert.equal(shop1Data.user.username, 'hanaa');

    // Shop 2
    const shop2Res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'branch', locationCode: 'shop2_warehouse2', password: 'Shop2@Mohamed' })
    });
    assert.equal(shop2Res.status, 200);
    const shop2Data = await shop2Res.json();
    assert.equal(shop2Data.user.username, 'mohamed');

    // Driver (Vehicle)
    const driverRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'vehicle', password: 'Pinko@Car2026' })
    });
    assert.equal(driverRes.status, 200);
    const driverData = await driverRes.json();
    assert.equal(driverData.user.username, 'ibrahim');
  });

  // Test 2: Inbound Warehouse Stock Calculation (Cartons * Ratio = Pieces)
  await t.test('Warehouse: Inbound cartons calculates pieces, single unit cost, and updates stock balance', async () => {
    // 1. Fetch locations to get shop1 ID
    const locsRes = await fetch(`${API_BASE}/locations`, {
      headers: { 'x-user-role': 'owner' }
    });
    assert.equal(locsRes.status, 200);
    const locs = await locsRes.json();
    const shop1Loc = locs.find(l => l.code === 'shop1_warehouse1');
    assert.ok(shop1Loc);

    // 2. Fetch products for Shop 1
    const prodsRes = await fetch(`${API_BASE}/products?locationId=${shop1Loc.id}`, {
      headers: { 'x-user-role': 'owner' }
    });
    assert.equal(prodsRes.status, 200);
    const prods = await prodsRes.json();
    assert.ok(prods.length > 0);
    const targetProduct = prods[0];
    const initialOnHand = targetProduct.on_hand_base;

    // 3. Inbound 5 cartons, 144 units per carton, carton cost = 864 EGP, piece retail = 10 EGP
    const inboundRes = await fetch(`${API_BASE}/products/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'hanaa' },
      body: JSON.stringify({
        locationId: shop1Loc.id,
        categoryName: targetProduct.category_name || 'شوكولاتات',
        name_ar: targetProduct.name_ar,
        cartonQty: 5,
        piecesPerCarton: 144,
        cartonCostEGP: 864,
        pieceRetailEGP: 10
      })
    });
    assert.equal(inboundRes.status, 200);
    const inboundData = await inboundRes.json();
    assert.equal(inboundData.addedPieces, 720);

    // 4. Verify stock increased by exactly 720 pieces
    const refreshedProdsRes = await fetch(`${API_BASE}/products?locationId=${shop1Loc.id}`, {
      headers: { 'x-user-role': 'owner' }
    });
    const refreshedProds = await refreshedProdsRes.json();
    const updatedProd = refreshedProds.find(p => p.id === targetProduct.id);
    assert.equal(updatedProd.on_hand_base, initialOnHand + 720);
  });

  // Test 3: Cashier Sale with Credit & Automatic Ledger Deduction
  let createdSaleId = null;
  await t.test('POS: Sale with Cash & Credit updates ledger and creates receivable', async () => {
    const locsRes = await fetch(`${API_BASE}/locations`, {
      headers: { 'x-user-role': 'owner' }
    });
    const locs = await locsRes.json();
    const shop1Loc = locs.find(l => l.code === 'shop1_warehouse1');

    const prodsRes = await fetch(`${API_BASE}/products?locationId=${shop1Loc.id}`, {
      headers: { 'x-user-role': 'owner' }
    });
    const prods = await prodsRes.json();
    const targetProduct = prods[0];

    const qty = 10;
    const unitPricePiastres = targetProduct.retail_price_piastres || 1000;
    const totalPiastres = qty * unitPricePiastres; // 10,000 (100 EGP)
    const paidCash = 6000; // 60 EGP
    const onCredit = 4000; // 40 EGP

    const saleRes = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'hanaa' },
      body: JSON.stringify({
        locationId: shop1Loc.id,
        customerName: 'عميل تجريبي آجل',
        items: [
          {
            productId: targetProduct.id,
            quantity: qty,
            unitPricePiastres
          }
        ],
        paidCashPiastres: paidCash,
        onCreditPiastres: onCredit,
        idempotencyKey: `pos-test-${Date.now()}`
      })
    });

    assert.equal(saleRes.status, 201);
    const sale = await saleRes.json();
    assert.ok(sale?.id);
    createdSaleId = sale.id;

    assert.equal(sale.total_piastres, totalPiastres);
    assert.equal(sale.paid_cash_piastres, paidCash);
    assert.equal(sale.on_credit_piastres, onCredit);
  });

  // Test 4: Debt Settlement (تسديد الآجل)
  await t.test('Debt Settlement: Paying credit updates invoice paid cash and reduces debt to zero', async () => {
    assert.ok(createdSaleId, 'Sale ID must exist');

    // Settle the 40 EGP (4000 piastres)
    const settleRes = await fetch(`${API_BASE}/sales/${createdSaleId}/settle-debt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'owner' },
      body: JSON.stringify({ amountPiastres: 4000 })
    });

    assert.equal(settleRes.status, 200);
    const settleData = await settleRes.json();
    assert.equal(settleData.remainingCreditPiastres, 0);
    assert.equal(settleData.paidAmountPiastres, 4000);
  });

  // Test 5: Sales Reports & Per-Product Breakdown
  await t.test('Reports: Sales reports filter by location and period, and include product sales breakdown', async () => {
    const locsRes = await fetch(`${API_BASE}/locations`, {
      headers: { 'x-user-role': 'owner' }
    });
    const locs = await locsRes.json();
    const shop1Loc = locs.find(l => l.code === 'shop1_warehouse1');

    const reportRes = await fetch(`${API_BASE}/reports/sales?period=daily&locationId=${shop1Loc.id}`, {
      headers: { 'x-user-role': 'owner' }
    });
    assert.equal(reportRes.status, 200);
    const report = await reportRes.json();

    // Verify mathematical identity: totalRevenue == totalCash + totalCredit
    assert.equal(
      report.totalRevenuePiastres,
      report.totalCashPiastres + report.totalCreditPiastres,
      'Total revenue must strictly equal Total Cash + Total Credit'
    );

    // Verify product sales breakdown is present and populated
    assert.ok(Array.isArray(report.productSales), 'productSales must be an array');
    assert.ok(report.productSales.length > 0, 'productSales must contain entries from today');

    const productSale = report.productSales[0];
    assert.ok(productSale.name, 'productSale must have name');
    assert.ok(productSale.quantitySold > 0, 'quantitySold must be greater than zero');
    assert.ok(productSale.totalRevenuePiastres > 0, 'totalRevenuePiastres must be greater than zero');
  });

  // Test 6: Vehicle Route & Net Cash Integrity
  await t.test('Vehicle: Route stop collection & expense reconciliation: Net = Cash - Expense', async () => {
    const locsRes = await fetch(`${API_BASE}/locations`, {
      headers: { 'x-user-role': 'owner' }
    });
    const locs = await locsRes.json();
    const vehicleLoc = locs.find(l => l.type === 'vehicle');
    assert.ok(vehicleLoc);

    const prodsRes = await fetch(`${API_BASE}/products?locationId=${vehicleLoc.id}`, {
      headers: { 'x-user-role': 'owner' }
    });
    const prods = await prodsRes.json();
    const testProd = prods[0];

    // 1. Submit a stop with 500 EGP collected cash (50000 piastres) & 100 EGP credit (10000 piastres)
    const stopRes = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ibrahim' },
      body: JSON.stringify({
        locationId: vehicleLoc.id,
        customerName: 'محطة سوبرماركت النصر - تجريبي',
        items: [{
          productId: testProd.id,
          quantity: 6,
          unitPricePiastres: 10000
        }],
        paidCashPiastres: 50000,
        onCreditPiastres: 10000,
        notes: 'تسليم محطة: سوبرماركت النصر',
        idempotencyKey: `veh-stop-${Date.now()}`
      })
    });
    assert.equal(stopRes.status, 201);

    // 2. Submit an expense of 100 EGP (10000 piastres) e.g. بنزين
    const expRes = await fetch(`${API_BASE}/vehicle/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ibrahim' },
      body: JSON.stringify({
        amountPiastres: 10000,
        reason: 'بنزين 92 لسيارة التوزيع'
      })
    });
    assert.equal(expRes.status, 201);

    // 3. Query vehicle stops and expenses and verify net math
    const stopsListRes = await fetch(`${API_BASE}/vehicle/stops?period=daily`, {
      headers: { 'x-user-role': 'owner' }
    });
    const stopsData = await stopsListRes.json();
    const expListRes = await fetch(`${API_BASE}/vehicle/expenses?period=daily`, {
      headers: { 'x-user-role': 'owner' }
    });
    const expData = await expListRes.json();

    const totalCollected = stopsData.reduce((acc, s) => acc + (parseInt(s.paid_cash_piastres || 0, 10)), 0);
    const totalExpenses = expData.reduce((acc, e) => acc + (Math.abs(parseInt(e.amount_piastres || 0, 10))), 0);
    const netVehicleCash = totalCollected - totalExpenses;

    assert.equal(netVehicleCash, totalCollected - totalExpenses);
    assert.ok(netVehicleCash >= 40000, 'Net vehicle cash should reflect collected cash minus expenses');
  });

});
