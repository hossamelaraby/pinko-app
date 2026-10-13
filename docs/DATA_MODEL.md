# DATA MODEL & LEDGER ACCOUNTING RULES

## 1. Domain Entities
The data model enforces strict relational integrity with foreign keys, constraints, and audit invariants.

### 1.1 Fixed Stock Locations
Every movement is bound to one of the 3 pre-configured locations:
1. **المحل 1 — المخزن 1** (`shop1_warehouse1`) - Retail Store & Warehouse 1.
2. **المحل 2 — المخزن 2** (`shop2_warehouse2`) - Retail Store & Warehouse 2.
3. **سيارة التوزيع — إبراهيم** (`vehicle_ibrahim`) - Stock location for distribution.

### 1.2 Multi-Unit System & Conversion Math
Products support three explicit tiers of packaging:
- **Base Unit (`piece` / قطعة):** The canonical atom. All stock records in `stock_ledger` and `stock_balances` are stored in this base unit.
- **Box Unit (`box` / علبة):** e.g., 1 box = 12 pieces (`box_ratio = 12`).
- **Carton Unit (`carton` / كرتونة):** e.g., 1 carton = 12 boxes = 144 pieces (`carton_ratio = 144`).

Conversion formulas:
$$Q_{\text{base}} = Q_{\text{carton}} \times \text{carton\_ratio}$$
$$Q_{\text{base}} = Q_{\text{box}} \times \text{box\_ratio}$$
$$Q_{\text{base}} = Q_{\text{piece}}$$

Fractional pieces or negative quantities are strictly rejected.

### 1.3 Immutable Stock Ledger
Stock on hand is **never directly modified via arbitrary UPDATE**.
- Whenever inventory moves, an atomic insertion into `stock_ledger` is executed.
- The `stock_balances` projection is maintained atomically within the same transaction.
- Invariant: $\sum \text{stock\_ledger.quantity\_base} = \text{stock\_balances.on\_hand\_base}$.
- Negative stock protection is active by default. If a transaction causes $Q_{\text{on\_hand}} < 0$, it is aborted immediately with HTTP 409 Conflict.

### 1.4 Customer Debt & Receivables
- Credit sales insert a positive debit amount into `customer_ledger`.
- Collections insert a negative credit amount into `customer_ledger`.
- Customer current balance is calculated as:
$$\text{Balance} = \sum \text{customer\_ledger.amount\_piastres}$$
- Direct edits to customer balances are strictly prohibited.

### 1.5 Cash Shifts & Reconciliation
- A shift records opening float $\text{Float}_{\text{open}}$.
- Cash sales, collections, refunds, and owner withdrawals record atomic movements in `cash_movements`.
- Expected cash at shift close:
$$\text{Expected} = \text{Float}_{\text{open}} + \sum \text{Cash Inflows} - \sum \text{Cash Outflows}$$
- Counted cash $\text{Counted}$ is entered by cashier; variance is persisted:
$$\text{Variance} = \text{Counted} - \text{Expected}$$
