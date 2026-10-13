-- ============================================================================
-- PINKO APP DATABASE SCHEMA (PostgreSQL / Neon)
-- Strictly Relational, Audited, Ledger-Backed, and Multi-Location
-- ============================================================================

-- 1. Businesses & Locations
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Cairo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'shop_warehouse', 'vehicle'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_business_location_code UNIQUE(business_id, code)
);

-- 2. Users and Auth
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    username VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'owner', 'shop_manager', 'cashier', 'stock_worker', 'driver'
    assigned_location_id UUID REFERENCES locations(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_business_username UNIQUE(business_id, username)
);

-- 3. Products and Units
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL,
    barcode VARCHAR(100),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    base_unit VARCHAR(50) NOT NULL DEFAULT 'piece', -- e.g., 'piece'
    box_unit VARCHAR(50) DEFAULT 'box',
    box_ratio INT DEFAULT 1, -- e.g. 12 pieces in 1 box
    carton_unit VARCHAR(50) DEFAULT 'carton',
    carton_ratio INT DEFAULT 1, -- e.g. 144 pieces in 1 carton
    retail_price_piastres BIGINT NOT NULL, -- in piastres (100 = 1 EGP)
    wholesale_price_piastres BIGINT NOT NULL,
    cost_price_piastres BIGINT NOT NULL DEFAULT 0,
    reorder_threshold INT NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_business_sku UNIQUE(business_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(business_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_name_ar ON products(business_id, name_ar);

-- 4. Immutable Stock Ledger & Balance Projections
CREATE TABLE IF NOT EXISTS stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES locations(id) ON DELETE RESTRICT, -- NULL for in-transit origins/losses if applicable
    movement_type VARCHAR(50) NOT NULL, -- 'receipt', 'transfer_dispatch', 'transfer_receive', 'sale', 'return', 'damage', 'adjustment'
    quantity_base INT NOT NULL, -- positive for stock addition, negative for stock reduction
    reference_id VARCHAR(100), -- Linked document ID (e.g. sale_id, transfer_id)
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_prod_loc ON stock_ledger(business_id, product_id, location_id);

-- Atomic projected balance cache (must strictly match ledger sum)
CREATE TABLE IF NOT EXISTS stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    on_hand_base INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_stock_prod_loc UNIQUE(business_id, product_id, location_id)
);

-- 5. Inter-Location & Vehicle Transfers
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    transfer_number VARCHAR(100) NOT NULL,
    source_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'dispatched', 'received', 'partial_received', 'cancelled'
    notes TEXT,
    dispatched_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    dispatched_at TIMESTAMPTZ,
    received_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_transfer_number UNIQUE(business_id, transfer_number)
);

CREATE TABLE IF NOT EXISTS transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    dispatched_qty_base INT NOT NULL,
    received_qty_base INT NOT NULL DEFAULT 0,
    damaged_qty_base INT NOT NULL DEFAULT 0,
    notes TEXT
);

-- 6. Customers and Receivables Ledger
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    credit_limit_piastres BIGINT NOT NULL DEFAULT 0,
    credit_terms_days INT NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    entry_type VARCHAR(50) NOT NULL, -- 'credit_sale', 'collection', 'return_credit', 'adjustment'
    amount_piastres BIGINT NOT NULL, -- Positive increases customer debt, negative decreases debt
    reference_id VARCHAR(100),
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_cust ON customer_ledger(business_id, customer_id);

-- 7. Cheques (Owner-Only)
CREATE TABLE IF NOT EXISTS cheques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    cheque_number VARCHAR(100) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    amount_piastres BIGINT NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'received', -- 'received', 'deposited', 'cleared', 'bounced', 'cancelled'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Cash Drawer Shifts & Cash Movements
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,
    opening_float_piastres BIGINT NOT NULL DEFAULT 0,
    expected_cash_piastres BIGINT,
    counted_cash_piastres BIGINT,
    variance_piastres BIGINT,
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'closed'
    close_notes TEXT
);

CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL, -- 'sale_cash', 'sale_refund', 'debt_collection', 'expense', 'owner_draw', 'float_adjustment'
    amount_piastres BIGINT NOT NULL, -- Positive for inflow, negative for outflow
    reference_id VARCHAR(100),
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Point of Sale (POS) & Vehicle Sales
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(100) NOT NULL,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    shift_id UUID REFERENCES shifts(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    subtotal_piastres BIGINT NOT NULL,
    discount_piastres BIGINT NOT NULL DEFAULT 0,
    total_piastres BIGINT NOT NULL,
    paid_cash_piastres BIGINT NOT NULL DEFAULT 0,
    paid_card_piastres BIGINT NOT NULL DEFAULT 0,
    on_credit_piastres BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'completed', -- 'completed', 'returned', 'partially_returned'
    notes TEXT,
    idempotency_key VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sale_invoice UNIQUE(business_id, invoice_number),
    CONSTRAINT uq_sale_idempotency UNIQUE(business_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    unit VARCHAR(50) NOT NULL, -- 'piece', 'box', 'carton'
    quantity INT NOT NULL,
    quantity_base INT NOT NULL,
    unit_price_piastres BIGINT NOT NULL,
    total_price_piastres BIGINT NOT NULL
);

-- 10. Returns and Refunds
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    return_number VARCHAR(100) NOT NULL,
    original_sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    shift_id UUID REFERENCES shifts(id) ON DELETE RESTRICT,
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_refund_piastres BIGINT NOT NULL,
    refund_method VARCHAR(50) NOT NULL, -- 'cash', 'credit_note', 'card'
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_return_number UNIQUE(business_id, return_number)
);

CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_base INT NOT NULL,
    refund_amount_piastres BIGINT NOT NULL,
    disposition VARCHAR(50) NOT NULL -- 'restock', 'damaged'
);

-- 11. Ibrahim's Delivery Route Sessions
CREATE TABLE IF NOT EXISTS route_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    vehicle_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'closed'
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,
    counted_cash_piastres BIGINT,
    expected_cash_piastres BIGINT,
    cash_variance_piastres BIGINT,
    notes TEXT
);

-- 12. Security Audit Log & Idempotency Store
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(50),
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    client_operation_id VARCHAR(128),
    server_transaction_id VARCHAR(128) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100),
    entity_id VARCHAR(100),
    details_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_status INT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
