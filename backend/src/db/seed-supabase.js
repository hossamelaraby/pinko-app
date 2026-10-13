import { getSupabase } from './supabase.js';
import bcrypt from 'bcryptjs';

// Specific, creative, memorable passwords per role
export const ROLE_PASSWORDS = {
  owner: 'Pinko@Boss2026',        // المالك
  shop1: 'Shop1@Hanaa',          // المحل 1
  shop2: 'Shop2@Mohamed',        // المحل 2
  driver: 'Pinko@Car2026'        // سيارة التوزيع (إبراهيم)
};

export async function seedSupabaseData() {
  const supabase = getSupabase();

  console.log('🌱 Verifying & Updating Supabase database with creative credentials & catalog...');

  // 1. Business
  const { data: existingBusiness } = await supabase
    .from('businesses')
    .select('*')
    .limit(1);

  let businessId;
  if (existingBusiness && existingBusiness.length > 0) {
    businessId = existingBusiness[0].id;
  } else {
    const { data: bus, error: busErr } = await supabase
      .from('businesses')
      .insert({
        name: 'Pinko App Confectionery',
        currency: 'EGP',
        timezone: 'Africa/Cairo'
      })
      .select()
      .single();

    if (busErr) throw busErr;
    businessId = bus.id;
  }

  // 2. Fixed Locations
  const requiredLocations = [
    { code: 'shop1_warehouse1', name: 'المحل 1 — المخزن 1', type: 'shop_warehouse' },
    { code: 'shop2_warehouse2', name: 'المحل 2 — المخزن 2', type: 'shop_warehouse' },
    { code: 'vehicle_ibrahim', name: 'سيارة التوزيع — إبراهيم', type: 'vehicle' }
  ];

  const locationsMap = {};
  for (const loc of requiredLocations) {
    const { data: existingLoc } = await supabase
      .from('locations')
      .select('*')
      .eq('business_id', businessId)
      .eq('code', loc.code)
      .limit(1);

    if (existingLoc && existingLoc.length > 0) {
      locationsMap[loc.code] = existingLoc[0].id;
    } else {
      const { data: newLoc, error: locErr } = await supabase
        .from('locations')
        .insert({
          business_id: businessId,
          code: loc.code,
          name: loc.name,
          type: loc.type
        })
        .select()
        .single();

      if (locErr) throw locErr;
      locationsMap[loc.code] = newLoc.id;
    }
  }

  // 3. System Users with Distinct Passwords
  const usersToUpdate = [
    { username: 'owner', full_name: 'مالك النشاط (Owner)', role: 'owner', assigned_location_id: null, pass: ROLE_PASSWORDS.owner },
    { username: 'hanaa', full_name: 'هناء - مدير المحل 1', role: 'shop_manager', assigned_location_id: locationsMap['shop1_warehouse1'], pass: ROLE_PASSWORDS.shop1 },
    { username: 'mohamed', full_name: 'محمد - مدير المحل 2', role: 'shop_manager', assigned_location_id: locationsMap['shop2_warehouse2'], pass: ROLE_PASSWORDS.shop2 },
    { username: 'ibrahim', full_name: 'إبراهيم - سائق التوزيع', role: 'driver', assigned_location_id: locationsMap['vehicle_ibrahim'], pass: ROLE_PASSWORDS.driver }
  ];

  const usersMap = {};
  for (const u of usersToUpdate) {
    const hashed = await bcrypt.hash(u.pass, 10);
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('business_id', businessId)
      .eq('username', u.username)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      // Update password hash
      await supabase
        .from('users')
        .update({ password_hash: hashed, role: u.role, assigned_location_id: u.assigned_location_id })
        .eq('id', existingUser[0].id);
      usersMap[u.username] = existingUser[0].id;
    } else {
      const { data: newUser, error: uErr } = await supabase
        .from('users')
        .insert({
          business_id: businessId,
          username: u.username,
          full_name: u.full_name,
          password_hash: hashed,
          role: u.role,
          assigned_location_id: u.assigned_location_id
        })
        .select()
        .single();

      if (uErr) throw uErr;
      usersMap[u.username] = newUser.id;
    }
  }

  // 4. Categories: شوكولاتات، بسكويتات، شيبسيات، لبان ومصاصات
  const initialCategories = ['شوكولاتات', 'بسكويتات', 'شيبسيات', 'لبان ومصاصات'];
  const catMap = {};
  for (const catName of initialCategories) {
    const { data: existingCat } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', businessId)
      .eq('name', catName)
      .limit(1);

    if (existingCat && existingCat.length > 0) {
      catMap[catName] = existingCat[0].id;
    } else {
      const { data: newCat } = await supabase
        .from('categories')
        .insert({ business_id: businessId, name: catName })
        .select()
        .single();
      if (newCat) catMap[catName] = newCat.id;
    }
  }

  // 5. Initial Products with buy cost and sell price
  const sampleProducts = [
    {
      cat: 'شوكولاتات',
      name_ar: 'شوكولاتة بينكو بالبندق',
      sku: 'CHOC-001',
      cost: 600, // 6 EGP
      retail: 1000, // 10 EGP
      carton_ratio: 144
    },
    {
      cat: 'بسكويتات',
      name_ar: 'بسكويت بينكو ويفر فانيليا',
      sku: 'BISC-001',
      cost: 300, // 3 EGP
      retail: 500, // 5 EGP
      carton_ratio: 72
    },
    {
      cat: 'شيبسيات',
      name_ar: 'شيبسي بينكو سوبر جبنة',
      sku: 'CHIP-001',
      cost: 500, // 5 EGP
      retail: 800, // 8 EGP
      carton_ratio: 40
    }
  ];

  for (const sp of sampleProducts) {
    const { data: existingP } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('sku', sp.sku)
      .limit(1);

    let pId;
    if (existingP && existingP.length > 0) {
      pId = existingP[0].id;
    } else {
      const { data: newP } = await supabase
        .from('products')
        .insert({
          business_id: businessId,
          category_id: catMap[sp.cat],
          sku: sp.sku,
          name_ar: sp.name_ar,
          cost_price_piastres: sp.cost,
          retail_price_piastres: sp.retail,
          wholesale_price_piastres: sp.cost + 100,
          carton_ratio: sp.carton_ratio
        })
        .select()
        .single();
      if (newP) pId = newP.id;
    }

    // Ensure initial balance for each location
    if (pId) {
      for (const locCode of Object.keys(locationsMap)) {
        const locId = locationsMap[locCode];
        const { data: b } = await supabase
          .from('stock_balances')
          .select('*')
          .eq('product_id', pId)
          .eq('location_id', locId)
          .limit(1);

        if (!b || b.length === 0) {
          await supabase.from('stock_balances').insert({
            business_id: businessId,
            product_id: pId,
            location_id: locId,
            on_hand_base: 100 // Seed initial 100 units for smooth immediate test
          });
        }
      }
    }
  }

  // 6. Ensure default customer for credit/ledger tests
  let customerId;
  const { data: existingCust } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .limit(1);

  if (existingCust && existingCust.length > 0) {
    customerId = existingCust[0].id;
  } else {
    const { data: newCust, error: cErr } = await supabase
      .from('customers')
      .insert({
        business_id: businessId,
        name: 'عميل الجملة التجريبي',
        phone: '01000000001',
        credit_limit_piastres: 5000000,
        current_balance_piastres: 0
      })
      .select()
      .single();
    if (!cErr && newCust) customerId = newCust.id;
  }

  // Get the first product id for test references
  let productId;
  const { data: firstProd } = await supabase
    .from('products')
    .select('id')
    .eq('business_id', businessId)
    .limit(1);
  if (firstProd && firstProd.length > 0) {
    productId = firstProd[0].id;
  }

  console.log('🎯 Supabase seeding fully updated.');
  return {
    businessId,
    locations: locationsMap,
    users: usersMap,
    productId,
    customerId
  };
}
