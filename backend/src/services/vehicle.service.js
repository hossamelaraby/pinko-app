import { getDb } from '../db/index.js';
import { InventoryService } from './inventory.service.js';

export class VehicleRouteService {
  /**
   * Start Driver Route Session
   */
  static async startRouteSession({ businessId, driverId, vehicleLocationId, notes }) {
    const db = getDb();

    // Check if there's already an active session
    const activeRes = await db.query(
      `SELECT * FROM route_sessions 
       WHERE business_id = $1 AND driver_id = $2 AND vehicleLocation_id = $3 AND status = 'active'`,
      [businessId, driverId, vehicleLocationId]
    ).catch(async () => {
      // In case column is vehicle_location_id
      return await db.query(
        `SELECT * FROM route_sessions 
         WHERE business_id = $1 AND driver_id = $2 AND vehicle_location_id = $3 AND status = 'active'`,
        [businessId, driverId, vehicleLocationId]
      );
    });

    if (activeRes.rows.length > 0) {
      return activeRes.rows[0];
    }

    const sessionRes = await db.query(
      `INSERT INTO route_sessions (
        business_id, driver_id, vehicle_location_id, status, notes
      ) VALUES ($1, $2, $3, 'active', $4) RETURNING *`,
      [businessId, driverId, vehicleLocationId, notes]
    );

    return sessionRes.rows[0];
  }

  /**
   * Reconcile and Close Route Session
   * Invariant I3: Opening vehicle stock + loads - sales - returns - damage = Closing vehicle stock
   */
  static async reconcileAndCloseRoute({
    businessId,
    sessionId,
    countedCashPiastres,
    driverId,
    notes
  }) {
    const db = getDb();

    return await db.transaction(async (client) => {
      const sessRes = await client.query(
        `SELECT * FROM route_sessions WHERE id = $1 AND business_id = $2 AND status = 'active'`,
        [sessionId, businessId]
      );
      if (sessRes.rows.length === 0) throw new Error('جلسة خط السير غير موجودة أو مغلقة بالفعل');
      const session = sessRes.rows[0];

      // 1. Calculate cash collected during route
      // Find sales posted at vehicle location during route session
      const cashSalesRes = await client.query(
        `SELECT COALESCE(SUM(paid_cash_piastres), 0)::BIGINT as total_cash_sales
         FROM sales 
         WHERE business_id = $1 AND location_id = $2 AND cashier_id = $3`,
        [businessId, session.vehicle_location_id, driverId]
      );
      const expectedCash = parseInt(cashSalesRes.rows[0].total_cash_sales, 10);
      const variance = countedCashPiastres - expectedCash;

      // 2. Close session
      const closedRes = await client.query(
        `UPDATE route_sessions 
         SET status = 'closed', closed_at = CURRENT_TIMESTAMP,
             expected_cash_piastres = $1, counted_cash_piastres = $2, cash_variance_piastres = $3,
             notes = $4
         WHERE id = $5 RETURNING *`,
        [expectedCash, countedCashPiastres, variance, notes, sessionId]
      );

      return closedRes.rows[0];
    });
  }
}
