# OPEN DECISIONS & BUSINESS CONFIGURATION

This document lists decisions and real-world parameters that only the business owner can provide. The system does not invent or fabricate these values. They are left blank or configurable by default.

## 1. Legal & Identity Details
- **Legal Business Name:** (Default: Pinko App) — Formal company registration name to be specified by owner.
- **Tax Registration Number / Tax ID:** Blank by default.
- **Commercial Registry (السجل التجاري):** Blank by default.
- **Official Address / Headquarters:** Blank by default.
- **Contact Phone / Customer Service Hotline:** Blank by default.

## 2. Opening Inventory & Balances
- **Real opening stock quantities:** Real balances for Warehouse 1, Warehouse 2, and Ibrahim's vehicle must be counted and posted via initial inventory receiving documents.
- **Actual supplier catalog and buy costs:** To be imported via CSV or recorded through official supplier receiving.
- **Real opening customer debt:** Outstanding balances from before Pinko App deployment must be recorded via approved opening credit adjustments.
- **Cash drawer opening floats:** Real cash floats for Shop 1 and Shop 2 to be entered upon shift opening.

## 3. Product Pricing & Policy
- **Wholesale vs Retail price tiers:** Owner to configure margin and price tiers per SKU.
- **Customer credit terms & limits:** Default grace period (days) and maximum allowable unpaid debt per customer.
- **Damage allowance policy:** Acceptable thresholds and whether manager authorization is required before stock write-off.

## 4. Hardware & Infrastructure
- **Handheld Android device model:** Actual Android device model and OS version.
- **Thermal Bluetooth printer model & command set:** (e.g., ESC/POS, 58mm vs 80mm). Android printer adapter interface is provided with PDF/Share fallback until paired with physical test hardware.
- **Production Neon PostgreSQL & Cloudflare Worker Credentials:** To be supplied in `.env` / Cloudflare Secrets during deployment.
