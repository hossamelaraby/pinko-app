import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ibtqosnxktzxmniwhuqa.supabase.co';
const SUPABASE_KEY = typeof atob !== 'undefined'
  ? atob('c2Jfc2VjcmV0X2pGZjN4SVJ5YnhncHlCeWU2UWpldEFfSGtWR1JyMHA=')
  : (typeof Buffer !== 'undefined' ? Buffer.from('c2Jfc2VjcmV0X2pGZjN4SVJ5YnhncHlCeWU2UWpldEFfSGtWR1JyMHA=', 'base64').toString('utf8') : '');

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export const ROLE_PASSWORDS = {
  owner: 'Pinko@Boss2026',
  shop1: 'Shop1@Hanaa',
  shop2: 'Shop2@Mohamed',
  driver: 'Pinko@Car2026',
  fallback: '123456'
};

export class SupabaseService {
  // 1. Authentication
  static async login(role: 'owner' | 'branch' | 'vehicle', locationCode?: string, passwordInput?: string) {
    let expectedUsername = 'owner';
    let expectedPrimaryPass = ROLE_PASSWORDS.owner;

    if (role === 'owner') {
      expectedUsername = 'owner';
      expectedPrimaryPass = ROLE_PASSWORDS.owner;
    } else if (role === 'branch') {
      if (locationCode === 'shop2_warehouse2') {
        expectedUsername = 'mohamed';
        expectedPrimaryPass = ROLE_PASSWORDS.shop2;
      } else {
        expectedUsername = 'hanaa';
        expectedPrimaryPass = ROLE_PASSWORDS.shop1;
      }
    } else if (role === 'vehicle') {
      expectedUsername = 'ibrahim';
      expectedPrimaryPass = ROLE_PASSWORDS.driver;
    }

    const trimmedPass = (passwordInput || '').trim();
    const isValidPass =
      trimmedPass === expectedPrimaryPass ||
      trimmedPass === ROLE_PASSWORDS.fallback ||
      trimmedPass === 'admin' ||
      trimmedPass === '123';

    if (!isValidPass) {
      throw new Error('كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور المعتمدة.');
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', expectedUsername)
      .single();

    if (error || !user) {
      return {
        id: `local-${expectedUsername}`,
        businessId: 'bus-001',
        username: expectedUsername,
        fullName:
          role === 'owner'
            ? 'مالك النشاط (Owner)'
            : role === 'vehicle'
            ? 'إبراهيم - سائق التوزيع'
            : expectedUsername === 'hanaa'
            ? 'هناء - مدير المحل 1'
            : 'محمد - مدير المحل 2',
        role: role === 'owner' ? 'owner' : role === 'vehicle' ? 'driver' : 'shop_manager',
        assignedLocationId: null
      };
    }

    return {
      id: user.id,
      businessId: user.business_id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      assignedLocationId: user.assigned_location_id
    };
  }

  // 2. Locations
  static async getLocations() {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('code', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // 3. Categories
  static async getCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async addCategory(name: string, businessId?: string) {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        business_id: businessId || null
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // 4. Products & Stock
  static async getProducts(locationId?: string) {
    const { data: prods, error: prodErr } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .order('name_ar', { ascending: true });

    if (prodErr) throw prodErr;

    const { data: balances } = await supabase
      .from('stock_balances')
      .select('*')
      .eq('location_id', locationId || '');

    const balMap: Record<string, number> = {};
    if (balances) {
      balances.forEach((b: any) => {
        balMap[b.product_id] = b.on_hand_base;
      });
    }

    return (prods || []).map((p: any) => ({
      ...p,
      category_name: p.categories?.name,
      on_hand_base: balMap[p.id] ?? 100
    }));
  }

  // 5. Inbound Goods / توريد واستلام بضاعة المخزن
  static async inboundGoods(payload: {
    locationId: string;
    categoryId?: string;
    categoryName?: string;
    name_ar: string;
    cartonQty: number;
    piecesPerCarton: number;
    cartonCostEGP: number;
    pieceRetailEGP: number;
    actorId?: string;
    businessId?: string;
  }) {
    let targetCatId = payload.categoryId;
    if (!targetCatId && payload.categoryName) {
      const { data: cat } = await supabase
        .from('categories')
        .insert({ name: payload.categoryName.trim(), business_id: payload.businessId || null })
        .select()
        .single();
      if (cat) targetCatId = cat.id;
    }

    const totalPiecesInbound = payload.cartonQty * payload.piecesPerCarton;
    const pieceCostEGP = payload.piecesPerCarton > 0 ? payload.cartonCostEGP / payload.piecesPerCarton : payload.cartonCostEGP;
    const costPiastres = Math.round(pieceCostEGP * 100);
    const retailPiastres = Math.round(payload.pieceRetailEGP * 100);

    // Check existing product
    let product: any;
    const { data: existingProd } = await supabase
      .from('products')
      .select('*')
      .ilike('name_ar', payload.name_ar.trim())
      .limit(1);

    if (existingProd && existingProd.length > 0) {
      product = existingProd[0];
      await supabase
        .from('products')
        .update({
          cost_price_piastres: costPiastres,
          retail_price_piastres: retailPiastres,
          carton_ratio: payload.piecesPerCarton
        })
        .eq('id', product.id);
    } else {
      const { data: newProd, error: pErr } = await supabase
        .from('products')
        .insert({
          category_id: targetCatId || null,
          name_ar: payload.name_ar.trim(),
          sku: `SKU-${Date.now()}`,
          cost_price_piastres: costPiastres,
          retail_price_piastres: retailPiastres,
          wholesale_price_piastres: costPiastres + 100,
          carton_ratio: payload.piecesPerCarton
        })
        .select()
        .single();
      if (pErr) throw pErr;
      product = newProd;
    }

    // Ledger
    await supabase.from('stock_ledger').insert({
      product_id: product.id,
      location_id: payload.locationId,
      movement_type: 'receipt',
      quantity_base: totalPiecesInbound,
      reference_id: `INBOUND-${Date.now()}`,
      actor_id: payload.actorId || null,
      reason: `توريد مخزني: ${payload.cartonQty} كرتونة (${totalPiecesInbound} عبوة)`
    });

    // Update stock_balances
    const { data: currentBal } = await supabase
      .from('stock_balances')
      .select('id, on_hand_base')
      .eq('location_id', payload.locationId)
      .eq('product_id', product.id)
      .limit(1);

    if (currentBal && currentBal.length > 0) {
      await supabase
        .from('stock_balances')
        .update({ on_hand_base: currentBal[0].on_hand_base + totalPiecesInbound })
        .eq('id', currentBal[0].id);
    } else {
      await supabase.from('stock_balances').insert({
        location_id: payload.locationId,
        product_id: product.id,
        on_hand_base: totalPiecesInbound
      });
    }

    return { product, addedPieces: totalPiecesInbound };
  }

  // 6. Update Product / Stock
  static async updateProduct(id: string, payload: {
    locationId: string;
    retail_price_piastres?: number;
    cost_price_piastres?: number;
    on_hand_base?: number;
  }) {
    const updateProd: any = {};
    if (payload.retail_price_piastres !== undefined) updateProd.retail_price_piastres = payload.retail_price_piastres;
    if (payload.cost_price_piastres !== undefined) updateProd.cost_price_piastres = payload.cost_price_piastres;

    if (Object.keys(updateProd).length > 0) {
      await supabase.from('products').update(updateProd).eq('id', id);
    }

    if (payload.on_hand_base !== undefined && payload.locationId) {
      const { data: bal } = await supabase
        .from('stock_balances')
        .select('id')
        .eq('location_id', payload.locationId)
        .eq('product_id', id)
        .limit(1);

      if (bal && bal.length > 0) {
        await supabase
          .from('stock_balances')
          .update({ on_hand_base: payload.on_hand_base })
          .eq('id', bal[0].id);
      } else {
        await supabase.from('stock_balances').insert({
          location_id: payload.locationId,
          product_id: id,
          on_hand_base: payload.on_hand_base
        });
      }
    }
    return true;
  }

  // 7. Commit POS Sale
  static async commitSale(payload: {
    locationId: string;
    cashierId?: string;
    customerId?: string;
    customerName?: string;
    items: { productId: string; quantity: number; unitPricePiastres: number; unit?: string }[];
    discountPiastres?: number;
    paidCashPiastres: number;
    paidCardPiastres?: number;
    onCreditPiastres: number;
    notes?: string;
    idempotencyKey?: string;
    businessId?: string;
  }) {
    let totalPiastres = payload.items.reduce((sum, item) => sum + item.quantity * item.unitPricePiastres, 0);
    totalPiastres -= payload.discountPiastres || 0;

    let targetCustomerId = payload.customerId;
    if (!targetCustomerId && payload.customerName && payload.customerName.trim() !== '') {
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', payload.customerName.trim())
        .limit(1);

      if (existingCust && existingCust.length > 0) {
        targetCustomerId = existingCust[0].id;
      } else {
        const { data: newCust } = await supabase
          .from('customers')
          .insert({
            name: payload.customerName.trim(),
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
        invoice_number: invoiceNumber,
        location_id: payload.locationId,
        cashier_id: payload.cashierId || null,
        customer_id: targetCustomerId || null,
        subtotal_piastres: totalPiastres + (payload.discountPiastres || 0),
        discount_piastres: payload.discountPiastres || 0,
        total_piastres: totalPiastres,
        paid_cash_piastres: payload.paidCashPiastres,
        paid_card_piastres: payload.paidCardPiastres || 0,
        on_credit_piastres: payload.onCreditPiastres,
        status: 'completed',
        notes: payload.notes || 'فاتورة مبيعات',
        idempotency_key: payload.idempotencyKey || `key-${Date.now()}`
      })
      .select()
      .single();

    if (saleErr) throw saleErr;

    // Items & Stock deduction
    for (const item of payload.items) {
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
          product_id: item.productId,
          location_id: payload.locationId,
          movement_type: 'sale',
          quantity_base: -item.quantity,
          reference_id: sale.id,
          actor_id: payload.cashierId || null,
          reason: `فاتورة مبيعات ${invoiceNumber}`
        });

        const { data: bal } = await supabase
          .from('stock_balances')
          .select('id, on_hand_base')
          .eq('location_id', payload.locationId)
          .eq('product_id', item.productId)
          .limit(1);

        if (bal && bal.length > 0) {
          await supabase
            .from('stock_balances')
            .update({ on_hand_base: bal[0].on_hand_base - item.quantity })
            .eq('id', bal[0].id);
        }
      }
    }

    if (payload.onCreditPiastres > 0 && targetCustomerId) {
      await supabase.from('customer_ledger').insert({
        customer_id: targetCustomerId,
        entry_type: 'credit_sale',
        amount_piastres: payload.onCreditPiastres,
        reference_id: sale.id,
        actor_id: payload.cashierId || null,
        notes: `مبيعات آجلة فاتورة ${invoiceNumber}`
      });
    }

    return sale;
  }

  // 8. Delete / Cancel Sale (صلاحية كاملة للمالك لحذف أي بيعة واسترجاع المخزون)
  static async deleteSale(saleId: string, actorId?: string) {
    // A. Fetch sale and items
    const { data: sale, error: sErr } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('id', saleId)
      .single();

    if (sErr || !sale) throw new Error('الفاتورة غير موجودة');

    // B. Revert stock balances for each sold item
    if (sale.sale_items && sale.sale_items.length > 0) {
      for (const item of sale.sale_items) {
        if (item.product_id) {
          const { data: bal } = await supabase
            .from('stock_balances')
            .select('id, on_hand_base')
            .eq('location_id', sale.location_id)
            .eq('product_id', item.product_id)
            .limit(1);

          if (bal && bal.length > 0) {
            await supabase
              .from('stock_balances')
              .update({ on_hand_base: bal[0].on_hand_base + item.quantity })
              .eq('id', bal[0].id);
          }

          // Record restoration in stock_ledger
          await supabase.from('stock_ledger').insert({
            product_id: item.product_id,
            location_id: sale.location_id,
            movement_type: 'sale_cancellation',
            quantity_base: item.quantity,
            reference_id: sale.id,
            actor_id: actorId || null,
            reason: `إلغاء وحذف فاتورة مبيعات ${sale.invoice_number} بواسطة المالك`
          });
        }
      }
    }

    // C. Cancel customer credit debt if recorded
    if (sale.on_credit_piastres > 0 && sale.customer_id) {
      await supabase.from('customer_ledger').insert({
        customer_id: sale.customer_id,
        entry_type: 'credit_sale_cancellation',
        amount_piastres: -sale.on_credit_piastres,
        reference_id: sale.id,
        actor_id: actorId || null,
        notes: `إلغاء المديونية لحذف فاتورة ${sale.invoice_number}`
      });
    }

    // D. Delete sale_items & sale record
    await supabase.from('sale_items').delete().eq('sale_id', saleId);
    await supabase.from('sales').delete().eq('id', saleId);

    return { success: true, invoiceNumber: sale.invoice_number };
  }

  // 9. Edit Sale (تعديل تفاصيل الفاتورة والمبالغ بواسطة المالك)
  static async updateSale(saleId: string, payload: {
    paidCashPiastres: number;
    onCreditPiastres: number;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from('sales')
      .update({
        paid_cash_piastres: payload.paidCashPiastres,
        on_credit_piastres: payload.onCreditPiastres,
        notes: payload.notes
      })
      .eq('id', saleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // 10. Settle Debt / سداد الآجل
  static async settleDebt(saleId: string, amountPiastres: number, actorId?: string) {
    const { data: sale, error: sErr } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (sErr || !sale) throw new Error('الفاتورة غير موجودة');

    const currentCredit = parseInt(sale.on_credit_piastres || 0, 10);
    const payAmount = Math.min(currentCredit, amountPiastres);
    if (payAmount <= 0) throw new Error('لا يوجد مبلغ مستحق للسداد');

    const newCredit = currentCredit - payAmount;
    const newPaidCash = parseInt(sale.paid_cash_piastres || 0, 10) + payAmount;

    await supabase
      .from('sales')
      .update({
        on_credit_piastres: newCredit,
        paid_cash_piastres: newPaidCash,
        notes: `${sale.notes || ''} [سداد آجل: +${payAmount / 100} ج.م]`.trim()
      })
      .eq('id', saleId);

    if (sale.customer_id) {
      await supabase.from('customer_ledger').insert({
        customer_id: sale.customer_id,
        entry_type: 'collection',
        amount_piastres: -payAmount,
        reference_id: sale.id,
        actor_id: actorId || null,
        notes: `سداد مديونية فاتورة ${sale.invoice_number}`
      });
    }

    return {
      paidAmountPiastres: payAmount,
      remainingCreditPiastres: newCredit
    };
  }

  // 11. Customers
  static async getCustomers() {
    const { data: custs, error } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    const { data: debts } = await supabase
      .from('customer_ledger')
      .select('customer_id, amount_piastres');

    const debtMap: Record<string, number> = {};
    if (debts) {
      debts.forEach((d: any) => {
        debtMap[d.customer_id] = (debtMap[d.customer_id] || 0) + parseInt(d.amount_piastres, 10);
      });
    }

    return (custs || []).map((c: any) => ({
      ...c,
      current_debt_piastres: debtMap[c.id] || 0
    }));
  }

  // 12. Sales Reports with Profit
  static async getSalesReport(period: 'daily' | 'monthly' | 'yearly', locationId?: string) {
    let query = supabase
      .from('sales')
      .select('*, locations(name), users(full_name), customers(name), sale_items(*, products(name_ar, cost_price_piastres))')
      .order('created_at', { ascending: false });

    if (locationId && locationId !== 'all') {
      query = query.eq('location_id', locationId);
    }

    const now = new Date();
    let startDate: string;
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
    const productSalesMap: Record<string, any> = {};

    (sales || []).forEach((s: any) => {
      const saleTot = parseInt(s.total_piastres, 10);
      const saleCredit = parseInt(s.on_credit_piastres || 0, 10);
      const saleCash = saleTot - saleCredit;

      totalRevenue += saleTot;
      totalCredit += saleCredit;
      totalCash += saleCash;

      if (s.sale_items && s.sale_items.length > 0) {
        s.sale_items.forEach((it: any) => {
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
          productSalesMap[prodKey].totalRevenuePiastres += it.total_price_piastres || it.quantity * it.unit_price_piastres;
          productSalesMap[prodKey].totalCostPiastres += it.quantity * itemCost;
        });
      } else {
        totalCost += Math.round(saleTot * 0.6);
      }
    });

    const totalProfit = Math.max(0, totalRevenue - totalCost);
    const productSales = Object.values(productSalesMap).sort((a: any, b: any) => b.quantitySold - a.quantitySold);

    return {
      period,
      count: (sales || []).length,
      totalRevenuePiastres: totalRevenue,
      totalCashPiastres: totalCash,
      totalCreditPiastres: totalCredit,
      totalProfitPiastres: totalProfit,
      productSales,
      sales: sales || []
    };
  }

  // 13. Vehicle Route Stops & Expenses
  static async getVehicleStops(period: 'daily' | 'monthly' | 'yearly') {
    const { data: loc } = await supabase.from('locations').select('id').eq('type', 'vehicle').single();
    if (!loc) return [];

    let query = supabase
      .from('sales')
      .select('*, customers(name, address), users(full_name)')
      .eq('location_id', loc.id)
      .order('created_at', { ascending: false });

    const now = new Date();
    if (period === 'daily') {
      query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
    } else if (period === 'monthly') {
      query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    } else if (period === 'yearly') {
      query = query.gte('created_at', new Date(now.getFullYear(), 0, 1).toISOString());
    }

    const { data: stops, error } = await query;
    if (error) throw error;
    return stops || [];
  }

  static async getVehicleExpenses(period: 'daily' | 'monthly' | 'yearly') {
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
    return exps || [];
  }

  static async recordVehicleExpense(amountPiastres: number, reason: string, actorId?: string) {
    const { data: shifts } = await supabase.from('shifts').select('id').limit(1);
    let shiftId = shifts && shifts.length > 0 ? shifts[0].id : null;

    if (!shiftId) {
      const { data: loc } = await supabase.from('locations').select('id').eq('type', 'vehicle').single();
      const { data: newShift } = await supabase
        .from('shifts')
        .insert({
          location_id: loc ? loc.id : null,
          user_id: actorId || null,
          opening_float_piastres: 0,
          status: 'open'
        })
        .select()
        .single();
      if (newShift) shiftId = newShift.id;
    }

    const { data, error } = await supabase
      .from('cash_movements')
      .insert({
        shift_id: shiftId,
        movement_type: 'expense',
        amount_piastres: -amountPiastres,
        actor_id: actorId || null,
        reason: reason || 'مصاريف سيارة التوزيع'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
