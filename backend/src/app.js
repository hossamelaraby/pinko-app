import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { getSupabase } from './db/supabase.js';
import { seedSupabaseData, ROLE_PASSWORDS } from './db/seed-supabase.js';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize seed data on startup in Supabase
seedSupabaseData().catch(err => {
  console.error('⚠️ Seeder notice:', err.message);
});

// Authentication Middleware with Role/Password Validation
const authenticate = async (req, res, next) => {
  const supabase = getSupabase();
  const username = req.headers['x-user-role'] || 'owner';

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*, locations(name)')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'المستخدم غير موجود أو غير مصرح له بالدخول' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التحقق من المستخدم' });
  }
};

// 1. Login / Verify Role Credentials Endpoint with Creative Passwords
app.post('/api/auth/login', async (req, res) => {
  const { role, locationCode, password } = req.body;
  const supabase = getSupabase();

  try {
    let username = 'owner';
    let expectedPass = ROLE_PASSWORDS.owner;

    if (role === 'owner') {
      username = 'owner';
      expectedPass = ROLE_PASSWORDS.owner;
    } else if (role === 'branch') {
      if (locationCode === 'shop2_warehouse2') {
        username = 'mohamed';
        expectedPass = ROLE_PASSWORDS.shop2;
      } else {
        username = 'hanaa';
        expectedPass = ROLE_PASSWORDS.shop1;
      }
    } else if (role === 'vehicle') {
      username = 'ibrahim';
      expectedPass = ROLE_PASSWORDS.driver;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    // Verify password via bcrypt or match
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch && password !== expectedPass) {
      return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        businessId: user.business_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        assignedLocationId: user.assigned_location_id
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'Pinko App Serverless API',
    database: 'Supabase PostgreSQL Cloud',
    timestamp: new Date().toISOString()
  });
});

// 3. Locations
app.get('/api/locations', authenticate, async (req, res) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('locations').select('*').eq('is_active', true);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 4. Categories: List and Add New Category
app.get('/api/categories', authenticate, async (req, res) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/categories', authenticate, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'اسم التصنيف مطلوب' });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('categories')
    .insert({
      business_id: req.user.business_id,
      name: name.trim()
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// 5. Products & Inventory
app.get('/api/products', authenticate, async (req, res) => {
  const supabase = getSupabase();
  const locationId = req.query.locationId || req.user.assigned_location_id;

  try {
    const { data: prods, error: prodErr } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .order('name_ar', { ascending: true });

    if (prodErr) throw prodErr;

    const { data: balances, error: balErr } = await supabase
      .from('stock_balances')
      .select('*')
      .eq('location_id', locationId);

    const balMap = {};
    if (balances) {
      balances.forEach(b => { balMap[b.product_id] = b.on_hand_base; });
    }

    const result = prods.map(p => ({
      ...p,
      category_name: p.categories?.name,
      on_hand_base: balMap[p.id] || 0
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add New Product or Inbound Goods (Receiving to Warehouse)
app.post('/api/products/inbound', authenticate, async (req, res) => {
  const {
    locationId,
    categoryId,
    categoryName,
    name_ar,
    sku,
    cartonQty = 1,
    piecesPerCarton = 1,
    cartonCostEGP = 0,
    pieceRetailEGP = 0
  } = req.body;

  if (!name_ar) return res.status(400).json({ error: 'اسم المنتج مطلوب' });

  const supabase = getSupabase();
  const locId = locationId || req.user.assigned_location_id;

  try {
    let targetCatId = categoryId;
    if (!targetCatId && categoryName) {
      const { data: cat } = await supabase
        .from('categories')
        .insert({ business_id: req.user.business_id, name: categoryName.trim() })
        .select()
        .single();
      if (cat) targetCatId = cat.id;
    }

    const totalPiecesInbound = cartonQty * piecesPerCarton;
    const pieceCostEGP = piecesPerCarton > 0 ? (cartonCostEGP / piecesPerCarton) : cartonCostEGP;
    const costPiastres = Math.round(pieceCostEGP * 100);
    const retailPiastres = Math.round(pieceRetailEGP * 100);

    // Check if product exists
    let product;
    const { data: existingProd } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', req.user.business_id)
      .ilike('name_ar', name_ar.trim())
      .limit(1);

    if (existingProd && existingProd.length > 0) {
      product = existingProd[0];
      // update cost and retail if provided
      await supabase
        .from('products')
        .update({
          cost_price_piastres: costPiastres,
          retail_price_piastres: retailPiastres,
          carton_ratio: piecesPerCarton
        })
        .eq('id', product.id);
    } else {
      const { data: newProd, error: pErr } = await supabase
        .from('products')
        .insert({
          business_id: req.user.business_id,
          category_id: targetCatId || null,
          name_ar: name_ar.trim(),
          sku: sku || `SKU-${Date.now()}`,
          cost_price_piastres: costPiastres,
          retail_price_piastres: retailPiastres,
          wholesale_price_piastres: costPiastres + 100,
          carton_ratio: piecesPerCarton
        })
        .select()
        .single();
      if (pErr) throw pErr;
      product = newProd;
    }

    // Record Inbound Movement in Stock Ledger
    await supabase.from('stock_ledger').insert({
      business_id: req.user.business_id,
      product_id: product.id,
      location_id: locId,
      movement_type: 'receipt',
      quantity_base: totalPiecesInbound,
      reference_id: `INBOUND-${Date.now()}`,
      actor_id: req.user.id,
      reason: `توريد مخزني: ${cartonQty} كرتونة (${totalPiecesInbound} عبوة)`
    });

    // Update or Insert stock_balances
    const { data: currentBal } = await supabase
      .from('stock_balances')
      .select('on_hand_base')
      .eq('location_id', locId)
      .eq('product_id', product.id)
      .limit(1);

    if (currentBal && currentBal.length > 0) {
      await supabase
        .from('stock_balances')
        .update({ on_hand_base: currentBal[0].on_hand_base + totalPiecesInbound })
        .eq('location_id', locId)
        .eq('product_id', product.id);
    } else {
      await supabase.from('stock_balances').insert({
        business_id: req.user.business_id,
        location_id: locId,
        product_id: product.id,
        on_hand_base: totalPiecesInbound
      });
    }

    res.json({
      success: true,
      product,
      addedPieces: totalPiecesInbound
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Existing Product / Inventory Adjustment
app.put('/api/products/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { name_ar, retail_price_piastres, cost_price_piastres, on_hand_base, locationId } = req.body;
  const supabase = getSupabase();
  const locId = locationId || req.user.assigned_location_id;

  try {
    const updatePayload = {};
    if (name_ar) updatePayload.name_ar = name_ar;
    if (retail_price_piastres !== undefined) updatePayload.retail_price_piastres = retail_price_piastres;
    if (cost_price_piastres !== undefined) updatePayload.cost_price_piastres = cost_price_piastres;

    if (Object.keys(updatePayload).length > 0) {
      await supabase.from('products').update(updatePayload).eq('id', id);
    }

    if (on_hand_base !== undefined && locId) {
      await supabase
        .from('stock_balances')
        .update({ on_hand_base })
        .eq('location_id', locId)
        .eq('product_id', id);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Commit POS Sale (with Cost & Profit Tracking)
app.post('/api/sales', authenticate, async (req, res) => {
  const supabase = getSupabase();
  const {
    locationId,
    customerId,
    customerName,
    items,
    discountPiastres = 0,
    paidCashPiastres = 0,
    paidCardPiastres = 0,
    onCreditPiastres = 0,
    notes,
    idempotencyKey
  } = req.body;

  if (!idempotencyKey) {
    return res.status(400).json({ error: 'مفتاح عدم التكرار مطلوب' });
  }

  try {
    let totalPiastres = 0;
    for (const item of items) {
      totalPiastres += item.quantity * item.unitPricePiastres;
    }
    totalPiastres -= discountPiastres;

    let targetCustomerId = customerId;
    if (!targetCustomerId && customerName && customerName.trim() !== '') {
      const { data: existingCust } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', req.user.business_id)
        .ilike('name', customerName.trim())
        .limit(1);

      if (existingCust && existingCust.length > 0) {
        targetCustomerId = existingCust[0].id;
      } else {
        const { data: newCust } = await supabase
          .from('customers')
          .insert({
            business_id: req.user.business_id,
            name: customerName.trim(),
            credit_limit_piastres: 1000000
          })
          .select()
          .single();
        if (newCust) targetCustomerId = newCust.id;
      }
    }

    const invoiceNumber = `INV-${Date.now()}`;

    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .insert({
        business_id: req.user.business_id,
        invoice_number: invoiceNumber,
        location_id: locationId || req.user.assigned_location_id,
        cashier_id: req.user.id,
        customer_id: targetCustomerId || null,
        subtotal_piastres: totalPiastres + discountPiastres,
        discount_piastres: discountPiastres,
        total_piastres: totalPiastres,
        paid_cash_piastres: paidCashPiastres,
        paid_card_piastres: paidCardPiastres,
        on_credit_piastres: onCreditPiastres,
        status: 'completed',
        notes: notes || 'فاتورة مبيعات',
        idempotency_key: idempotencyKey
      })
      .select()
      .single();

    if (saleErr) throw saleErr;

    // Deduct stock and record items
    for (const item of items) {
      if (item.productId && item.productId !== 'custom-item') {
        await supabase.from('sale_items').insert({
          sale_id: sale.id,
          product_id: item.productId,
          unit: item.unit || 'piece',
          quantity: item.quantity,
          quantity_base: item.quantity,
          unit_price_piastres: item.unitPricePiastres,
          total_price_piastres: item.quantity * item.unitPricePiastres
        });

        await supabase.from('stock_ledger').insert({
          business_id: req.user.business_id,
          product_id: item.productId,
          location_id: locationId || req.user.assigned_location_id,
          movement_type: 'sale',
          quantity_base: -item.quantity,
          reference_id: sale.id,
          actor_id: req.user.id,
          reason: `فاتورة مبيعات ${invoiceNumber}`
        });

        const { data: bal } = await supabase
          .from('stock_balances')
          .select('on_hand_base')
          .eq('location_id', locationId || req.user.assigned_location_id)
          .eq('product_id', item.productId)
          .single();

        if (bal) {
          await supabase
            .from('stock_balances')
            .update({ on_hand_base: bal.on_hand_base - item.quantity })
            .eq('location_id', locationId || req.user.assigned_location_id)
            .eq('product_id', item.productId);
        }
      }
    }

    if (onCreditPiastres > 0 && targetCustomerId) {
      await supabase.from('customer_ledger').insert({
        business_id: req.user.business_id,
        customer_id: targetCustomerId,
        entry_type: 'credit_sale',
        amount_piastres: onCreditPiastres,
        reference_id: sale.id,
        actor_id: req.user.id,
        notes: `مبيعات آجلة فاتورة ${invoiceNumber}`
      });
    }

    res.status(201).json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Settle / Pay Outstanding Debt on an Invoice
app.post('/api/sales/:id/settle-debt', authenticate, async (req, res) => {
  const { id } = req.params;
  const { amountPiastres, notes } = req.body;
  const supabase = getSupabase();

  try {
    const { data: sale, error: sErr } = await supabase
      .from('sales')
      .select('*')
      .eq('id', id)
      .single();

    if (sErr || !sale) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const currentCredit = parseInt(sale.on_credit_piastres || 0, 10);
    const payAmount = Math.min(currentCredit, parseInt(amountPiastres, 10));

    if (payAmount <= 0) return res.status(400).json({ error: 'لا يوجد مبلغ مستحق للسداد' });

    const newCredit = currentCredit - payAmount;
    const newPaidCash = parseInt(sale.paid_cash_piastres || 0, 10) + payAmount;

    // Update sale record
    await supabase
      .from('sales')
      .update({
        on_credit_piastres: newCredit,
        paid_cash_piastres: newPaidCash,
        notes: `${sale.notes || ''} [سداد آجل: +${payAmount / 100} ج.م]`.trim()
      })
      .eq('id', id);

    // Record in customer ledger if customer is linked
    if (sale.customer_id) {
      await supabase.from('customer_ledger').insert({
        business_id: req.user.business_id,
        customer_id: sale.customer_id,
        entry_type: 'collection',
        amount_piastres: -payAmount,
        reference_id: sale.id,
        actor_id: req.user.id,
        notes: notes || `سداد مديونية فاتورة ${sale.invoice_number}`
      });
    }

    res.json({
      success: true,
      paidAmountPiastres: payAmount,
      remainingCreditPiastres: newCredit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Customers
app.get('/api/customers', authenticate, async (req, res) => {
  const supabase = getSupabase();
  try {
    const { data: custs, error } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    const { data: debts } = await supabase
      .from('customer_ledger')
      .select('customer_id, amount_piastres');

    const debtMap = {};
    if (debts) {
      debts.forEach(d => {
        debtMap[d.customer_id] = (debtMap[d.customer_id] || 0) + parseInt(d.amount_piastres, 10);
      });
    }

    const result = custs.map(c => ({
      ...c,
      current_debt_piastres: debtMap[c.id] || 0
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Sales Reports with Profit Calculation (الأرباح = المبيعات - التكلفة)
app.get('/api/reports/sales', authenticate, async (req, res) => {
  const supabase = getSupabase();
  const { period = 'daily', locationId } = req.query;

  try {
    let query = supabase
      .from('sales')
      .select('*, locations(name), users(full_name), customers(name), sale_items(*, products(name_ar, cost_price_piastres))')
      .order('created_at', { ascending: false });

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const now = new Date();
    let startDate;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte('created_at', startDate);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      query = query.gte('created_at', startDate);
    } else if (period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      query = query.gte('created_at', startDate);
    }

    const { data: sales, error } = await query;
    if (error) throw error;

    let totalRevenue = 0;
    let totalCash = 0;
    let totalCredit = 0;
    let totalCost = 0;
    const productSalesMap = {};

    sales.forEach(s => {
      const saleTot = parseInt(s.total_piastres, 10);
      const saleCredit = parseInt(s.on_credit_piastres || 0, 10);
      const saleCash = saleTot - saleCredit;

      totalRevenue += saleTot;
      totalCredit += saleCredit;
      totalCash += saleCash;

      // Calculate cost and aggregate per product sales
      if (s.sale_items && s.sale_items.length > 0) {
        s.sale_items.forEach(it => {
          const itemCost = it.products?.cost_price_piastres || 0;
          totalCost += it.quantity * itemCost;

          const prodKey = it.product_id || it.products?.name_ar || 'other';
          const prodName = it.products?.name_ar || 'صنف مباشر';
          if (!productSalesMap[prodKey]) {
            productSalesMap[prodKey] = {
              productId: it.product_id,
              name: prodName,
              quantitySold: 0,
              totalRevenuePiastres: 0,
              totalCostPiastres: 0
            };
          }
          productSalesMap[prodKey].quantitySold += it.quantity;
          productSalesMap[prodKey].totalRevenuePiastres += it.total_price_piastres || (it.quantity * it.unit_price_piastres);
          productSalesMap[prodKey].totalCostPiastres += it.quantity * itemCost;
        });
      } else {
        totalCost += Math.round(saleTot * 0.6);
      }
    });

    const totalProfit = Math.max(0, totalRevenue - totalCost);
    const productSales = Object.values(productSalesMap).sort((a, b) => b.quantitySold - a.quantitySold);

    res.json({
      period,
      count: sales.length,
      totalRevenuePiastres: totalRevenue,
      totalCashPiastres: totalCash,
      totalCreditPiastres: totalCredit,
      totalProfitPiastres: totalProfit,
      productSales,
      sales
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Vehicle Route Stops (Filtered by Daily, Monthly, Yearly)
app.get('/api/vehicle/stops', authenticate, async (req, res) => {
  const supabase = getSupabase();
  const { period = 'daily' } = req.query;

  try {
    const { data: loc } = await supabase.from('locations').select('id').eq('type', 'vehicle').single();
    if (!loc) return res.json([]);

    let query = supabase
      .from('sales')
      .select('*, customers(name, address), users(full_name)')
      .eq('location_id', loc.id)
      .order('created_at', { ascending: false });

    const now = new Date();
    let startDate;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte('created_at', startDate);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      query = query.gte('created_at', startDate);
    } else if (period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      query = query.gte('created_at', startDate);
    }

    const { data: stops, error } = await query;
    if (error) throw error;
    res.json(stops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Vehicle Expenses: List and Record
app.get('/api/vehicle/expenses', authenticate, async (req, res) => {
  const supabase = getSupabase();
  const { period = 'daily' } = req.query;

  try {
    let query = supabase
      .from('cash_movements')
      .select('*')
      .eq('movement_type', 'expense')
      .order('created_at', { ascending: false });

    const now = new Date();
    if (period === 'daily') {
      query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
    } else if (period === 'monthly') {
      query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    } else if (period === 'yearly') {
      query = query.gte('created_at', new Date(now.getFullYear(), 0, 1).toISOString());
    }

    const { data: exps, error } = await query;
    if (error) throw error;
    res.json(exps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vehicle/expenses', authenticate, async (req, res) => {
  const { amountPiastres, reason } = req.body;
  if (!amountPiastres || amountPiastres <= 0) return res.status(400).json({ error: 'مبلغ المصروف مطلوب' });

  const supabase = getSupabase();

  try {
    // Look up or create open shift
    const { data: shifts } = await supabase.from('shifts').select('id').limit(1);
    let shiftId = shifts && shifts.length > 0 ? shifts[0].id : null;

    if (!shiftId) {
      const { data: loc } = await supabase.from('locations').select('id').eq('type', 'vehicle').single();
      const { data: newShift } = await supabase
        .from('shifts')
        .insert({
          business_id: req.user.business_id,
          location_id: loc.id,
          user_id: req.user.id,
          opening_float_piastres: 0,
          status: 'open'
        })
        .select()
        .single();
      if (newShift) shiftId = newShift.id;
    }

    const { data: movement, error } = await supabase
      .from('cash_movements')
      .insert({
        shift_id: shiftId,
        movement_type: 'expense',
        amount_piastres: -amountPiastres,
        actor_id: req.user.id,
        reason: reason || 'مصاريف سيارة التوزيع (بنزين/صيانة/إكراميات)'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(movement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
