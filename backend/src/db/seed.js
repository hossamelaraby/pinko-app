import { getDb } from './index.js';
import bcrypt from 'bcryptjs';

export async function seedInitialData() {
  const db = getDb();

  // 1. Create Business
  const businessRes = await db.query(
    `INSERT INTO businesses (name, currency, timezone) 
     VALUES ($1, $2, $3) RETURNING id`,
    ['Pinko App Confectionery', 'EGP', 'Africa/Cairo']
  );
  const businessId = businessRes.rows[0].id;

  // 2. Fixed Locations (Strict requirement: Shop 1, Shop 2, Ibrahim's Vehicle)
  const loc1 = await db.query(
    `INSERT INTO locations (business_id, code, name, type) 
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [businessId, 'shop1_warehouse1', 'المحل 1 — المخزن 1', 'shop_warehouse']
  );
  const locShop1Id = loc1.rows[0].id;

  const loc2 = await db.query(
    `INSERT INTO locations (business_id, code, name, type) 
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [businessId, 'shop2_warehouse2', 'المحل 2 — المخزن 2', 'shop_warehouse']
  );
  const locShop2Id = loc2.rows[0].id;

  const loc3 = await db.query(
    `INSERT INTO locations (business_id, code, name, type) 
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [businessId, 'vehicle_ibrahim', 'سيارة التوزيع — إبراهيم', 'vehicle']
  );
  const locVehicleId = loc3.rows[0].id;

  // 3. System Users with specific roles and assignments
  const passwordHash = await bcrypt.hash('Pinko@Sec2026', 10);

  // Owner
  const ownerRes = await db.query(
    `INSERT INTO users (business_id, username, full_name, password_hash, role) 
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [businessId, 'owner', 'مالك النشاط', passwordHash, 'owner']
  );
  const ownerId = ownerRes.rows[0].id;

  // Shop 1 Manager (Hanaa)
  const hanaaRes = await db.query(
    `INSERT INTO users (business_id, username, full_name, password_hash, role, assigned_location_id) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [businessId, 'hanaa', 'هناء - مدير المحل 1', passwordHash, 'shop_manager', locShop1Id]
  );
  const hanaaId = hanaaRes.rows[0].id;

  // Shop 2 Cashier (Mohamed)
  const mohamedRes = await db.query(
    `INSERT INTO users (business_id, username, full_name, password_hash, role, assigned_location_id) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [businessId, 'mohamed', 'محمد - كاشير المحل 2', passwordHash, 'cashier', locShop2Id]
  );
  const mohamedId = mohamedRes.rows[0].id;

  // Stock Worker (Abdelrahman)
  const abdelrahmanRes = await db.query(
    `INSERT INTO users (business_id, username, full_name, password_hash, role, assigned_location_id) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [businessId, 'abdelrahman', 'عبدالرحمن - أمين المخزن', passwordHash, 'stock_worker', locShop1Id]
  );
  const abdelrahmanId = abdelrahmanRes.rows[0].id;

  // Driver (Ibrahim)
  const ibrahimRes = await db.query(
    `INSERT INTO users (business_id, username, full_name, password_hash, role, assigned_location_id) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [businessId, 'ibrahim', 'إبراهيم - سائق التوزيع', passwordHash, 'driver', locVehicleId]
  );
  const ibrahimId = ibrahimRes.rows[0].id;

  // 4. Products & Categories (Confectionery Items)
  const catRes = await db.query(
    `INSERT INTO categories (business_id, name) VALUES ($1, $2) RETURNING id`,
    [businessId, 'شوكولاتة وبسكويت']
  );
  const catId = catRes.rows[0].id;

  // Sample Product 1: Chocolate Bar
  // 1 Carton = 12 Boxes = 144 Pieces
  // Retail: 10 EGP (1000 Piastres), Wholesale: 8 EGP (800 Piastres), Cost: 6 EGP (600 Piastres)
  const prod1Res = await db.query(
    `INSERT INTO products (
      business_id, category_id, sku, barcode, name_ar, name_en,
      base_unit, box_unit, box_ratio, carton_unit, carton_ratio,
      retail_price_piastres, wholesale_price_piastres, cost_price_piastres, reorder_threshold
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      'piece', 'box', 12, 'carton', 144,
      1000, 800, 600, 20
    ) RETURNING id`,
    [businessId, catId, 'CHOC-001', '6221234567890', 'شوكولاتة بينكو بالبندق', 'Pinko Hazelnut Chocolate']
  );
  const prod1Id = prod1Res.rows[0].id;

  // Initialize stock balances projection for all 3 locations
  await db.query(
    `INSERT INTO stock_balances (business_id, product_id, location_id, on_hand_base)
     VALUES ($1, $2, $3, 0), ($1, $2, $4, 0), ($1, $2, $5, 0)`,
    [businessId, prod1Id, locShop1Id, locShop2Id, locVehicleId]
  );

  // 5. Sample Customer
  const custRes = await db.query(
    `INSERT INTO customers (business_id, name, phone, address, credit_limit_piastres, credit_terms_days)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [businessId, 'سوبر ماركت الأمانة - المعادي', '01012345678', 'القاهرة - المعادي', 500000, 30] // Limit: 5,000 EGP
  );
  const custId = custRes.rows[0].id;

  return {
    businessId,
    locations: {
      shop1: locShop1Id,
      shop2: locShop2Id,
      vehicle: locVehicleId
    },
    users: {
      owner: ownerId,
      hanaa: hanaaId,
      mohamed: mohamedId,
      abdelrahman: abdelrahmanId,
      ibrahim: ibrahimId
    },
    products: {
      choc: prod1Id
    },
    customers: {
      amana: custId
    }
  };
}
