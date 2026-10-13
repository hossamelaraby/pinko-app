# ROLES AND PERMISSIONS MATRIX

Pinko App implements server-enforced Role-Based Access Control (RBAC). Hiding UI controls is not security; every server endpoint inspects the authenticated actor's business ID, role, and assigned location.

## Roles

1. **Owner (`owner`):** Complete enterprise access across all shops, warehouses, vehicle routes, reports, audit trails, and user management. Sole authority to approve high-risk adjustments, cheque processing, and override policies.
2. **Shop Manager (`shop_manager`):** Access restricted strictly to assigned shop/warehouse. Manages shifts, sales, receipts, and localized stock movements. Cannot view system profits, other branches, manage global users, or clear cheques.
3. **Cashier (`cashier`):** Restricted strictly to assigned shop and active register/shift. Can search catalog, create sales, receive payments, print receipts, and issue returns linked to original sales. Cannot edit stock balances, alter costs, view profit margins, or access other branches.
4. **Stock Worker (`stock_worker`):** Restricted to assigned warehouse location. Can record goods receipts, dispatch/receive transfers, and perform stock count records. Cannot edit prices, view financial reports, or access customer debts.
5. **Driver (`driver` - Ibrahim):** Restricted strictly to vehicle stock, assigned delivery route, customer deliveries/collections, returns, and vehicle route closeout. Cannot view branch financial reports, modify other locations, or clear cheques.

## Permission Matrix

| Operation / Feature | Owner | Shop Manager | Cashier | Stock Worker | Driver |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **All Locations Visibility** | Yes | No (Assigned only) | No (Assigned only) | No (Assigned only) | No (Vehicle only) |
| **View Cost Price & Profit Margin** | Yes | No | No | No | No |
| **Manage Users & Roles** | Yes | No | No | No | No |
| **View Audit Logs** | Yes | No | No | No | No |
| **Override Negative Stock Policy** | Yes | No | No | No | No |
| **Cheque Records & Clearance** | Yes | No | No | No | No |
| **POS Sales & Payment Split** | Yes | Yes (Assigned) | Yes (Assigned) | No | Yes (Vehicle route) |
| **Return & Refund (Linked to Sale)**| Yes | Yes (Assigned) | Yes (Assigned) | No | Yes (Vehicle route) |
| **Open / Close Shift** | Yes | Yes (Assigned) | Yes (Assigned) | No | No |
| **Inter-warehouse Transfers** | Yes | Yes (Assigned) | No | Yes (Assigned) | No (Dispatch/Return only) |
| **Supplier Receiving** | Yes | Yes (Assigned) | No | Yes (Assigned) | No |
| **Customer Credit Collection** | Yes | Yes (Assigned) | Yes (Assigned) | No | Yes (Assigned route) |
| **Vehicle Route Session & Closeout**| Yes | Yes (Review) | No | No | Yes (Ibrahim) |
| **Cloud Quota & Health Monitor** | Yes | No | No | No | No |

## Security Rules
- **Deny by default:** Any unrecognized role or missing location assignment results in an immediate `403 Forbidden` response.
- **Tenant Isolation:** Every database query checks `business_id` and authorized `location_id`.
- **Audit Immutability:** Every state-altering action logs an immutable audit event recording `actor_id`, `role`, `location_id`, `client_operation_id`, `server_transaction_id`, and payload summary.
- **No Direct Balance Updates:** Balances (stock, cash, debt) can never be updated directly via SQL `UPDATE balance = ...`. They are strictly derived or updated atomically via ledger transactions.
