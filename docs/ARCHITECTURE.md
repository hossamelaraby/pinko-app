# PINKO APP SYSTEM ARCHITECTURE

## 1. System Overview
Pinko App is an enterprise-grade wholesale/retail ERP and Point-of-Sale (POS) designed for confectionery distribution in Egypt. It operates under a strict **Online-Only Contract**, with high-performance security, auditable ledger accounting, and absolute data integrity.

```
+---------------------------------------------------------------------------------------+
|                               Android Handheld Client                                 |
|          (Capacitor / Mobile Web - Arabic RTL - Offline Block - Idempotent API Client) |
+---------------------------------------------------------------------------------------+
                                           |
                                  HTTPS / JSON (Bearer JWT)
                                           v
+---------------------------------------------------------------------------------------+
|                                  Backend API Service                                  |
|            (Cloudflare Worker / Node.js Engine - RBAC - Idempotency Guardian)         |
+---------------------------------------------------------------------------------------+
                                           |
                              PostgreSQL Pool / Connection
                                           v
+---------------------------------------------------------------------------------------+
|                         Neon PostgreSQL Database of Record                            |
|             (Normalized Schema, Ledger-Backed Inventory, Audited Mutations)           |
+---------------------------------------------------------------------------------------+
```

## 2. Trust Boundaries & Security Model
1. **Client Trust Level: Untrusted.**
   - The Android client never contains database credentials, master keys, or bypass tokens.
   - Prices, discounts, totals, available quantities, and balances are never calculated on the client for authoritative writes; all arithmetic is verified server-side.
2. **Online-Only Enforcement:**
   - No local database outbox. If the network drops or timeout occurs, the UI presents:
     «لا يوجد اتصال بالإنترنت. لم يتم تسجيل العملية.»
   - Idempotency keys (`Idempotency-Key` header) prevent double-billing on network retries.
3. **Ledger Immutability:**
   - Physical inventory is strictly recorded as movements in `stock_ledger`.
   - Customer credit is strictly recorded as transactions in `customer_ledger`.
   - Cash movements are strictly linked to shifts and transactions in `cash_movements`.
   - No posted document can ever be edited or deleted (`UPDATE ... SET status = ...` or compensating reversals are used).

## 3. High-Security Currency & Precision Arithmetic
- All monetary amounts are handled in **minor units (Piastres / قروش)** as safe 64-bit integers (`BIGINT`).
- Zero floating-point drift: `1 EGP = 100 Piastres`. `10.50 EGP` is stored and computed as `1050`.
- Stock quantities are stored as integers representing canonical base units (e.g., individual piece / قطعة) with tested unit conversion matrices for boxes and cartons.

## 4. Free-Tier Quota Architecture & Operational Guardrails
- **Neon PostgreSQL Free Tier:**
  - Storage limit: 1 GB.
  - Compute hours: 100 CU-hours/month.
  - Scale to zero: 5 minutes idle time. Handled by connection warm-up retries and graceful reconnects.
- **Cloudflare Workers Free Tier:**
  - 100,000 requests/day.
- **Health & Monitoring:**
  - Built-in operational dashboard monitors database status, request latency, and storage footprint.
