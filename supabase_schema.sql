-- BHAWANI ENTERPRISES DATABASE SCHEMA
-- PostgreSQL / Supabase Migration Script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. WALLETS TABLE
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SERVICES TABLE
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL UNIQUE, -- e.g. 'jio_recharge', 'aeps_withdrawal', 'money_transfer'
    logo_url TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    quick_amounts INT[] NOT NULL,
    requires_wallet_selection BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SERVICE WALLET RULES TABLE
CREATE TABLE service_wallet_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE, -- NULL represents cash or dynamic selection
    action TEXT NOT NULL CHECK (action IN ('DEBIT', 'CREDIT')),
    direction TEXT NOT NULL CHECK (direction IN ('WALLET', 'CASH')),
    priority INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TRANSACTIONS TABLE
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL, -- Selected wallet if dynamic
    amount NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    transaction_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'synced' CHECK (status IN ('pending', 'synced')),
    synced BOOLEAN NOT NULL DEFAULT true,
    created_local BOOLEAN NOT NULL DEFAULT false,
    synced_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ, -- Soft delete support
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. WALLET LEDGER TABLE
CREATE TABLE wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL, -- Credit: positive, Debit: negative
    ledger_type TEXT NOT NULL CHECK (ledger_type IN ('opening', 'transaction', 'transfer', 'adjustment')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CASH LEDGER TABLE
CREATE TABLE cash_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL, -- Credit: positive, Debit: negative
    ledger_type TEXT NOT NULL CHECK (ledger_type IN ('opening', 'transaction', 'transfer', 'adjustment')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. SETTINGS TABLE
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ROW LEVEL SECURITY (RLS) POLICIES
-- Since there is only one shop owner account, we enable RLS and restrict access to authenticated users.

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_wallet_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for authenticated users)
CREATE POLICY "Allow all for authenticated users" ON wallets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON service_wallet_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON wallet_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON cash_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SEED DATA FOR SERVICES
INSERT INTO services (name, type, color, is_active, sort_order, quick_amounts, requires_wallet_selection) VALUES
('Jio Recharge', 'jio_recharge', '#0f3cc9', true, 1, ARRAY[149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], true),
('Airtel Recharge', 'airtel_recharge', '#e21226', true, 2, ARRAY[149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], true),
('VI Recharge', 'vi_recharge', '#eb0029', true, 3, ARRAY[149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], true),
('BSNL Recharge', 'bsnl_recharge', '#0f68b3', true, 4, ARRAY[149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], true),
('AEPS Cash Withdrawal', 'aeps_withdrawal', '#10b981', true, 5, ARRAY[500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000], false),
('Money Transfer', 'money_transfer', '#3b82f6', true, 6, ARRAY[]::integer[], false),
('Electricity Bill Payment', 'electricity_bill', '#0d9488', true, 7, ARRAY[]::integer[], true),
('Balance Enquiry', 'balance_enquiry', '#f97316', true, 8, ARRAY[]::integer[], false),
('Loan Repayment', 'loan_repayment', '#8b5cf6', true, 9, ARRAY[]::integer[], true);

-- SEED DATA FOR SHOP SETTINGS
INSERT INTO settings (key, value) VALUES
('shop_name', '"BHAWANI ENTERPRISES"'),
('setup_completed', 'false'),
('shop_logo', '""');
