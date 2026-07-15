-- BHAWANI ENTERPRISES DATABASE SCHEMA
-- PostgreSQL / Supabase Migration Script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. WALLETS TABLE
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    provider TEXT NOT NULL DEFAULT 'Other' CHECK (provider IN ('FINO', 'PhonePe', 'Google Pay', 'Spice Money', 'Other')),
    icon TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SERVICES TABLE
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
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

-- 4. WALLET TRANSFERS TABLE
CREATE TABLE wallet_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL, -- NULL represents CASH
    destination_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL, -- NULL represents CASH
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    notes VARCHAR(300),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TRANSACTIONS TABLE
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL, -- Selected wallet if dynamic
    transfer_id UUID REFERENCES wallet_transfers(id) ON DELETE SET NULL, -- Pointer to transfer if applicable
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    notes VARCHAR(300),
    transaction_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'synced' CHECK (status IN ('pending', 'synced')),
    synced BOOLEAN NOT NULL DEFAULT true,
    created_local BOOLEAN NOT NULL DEFAULT false,
    synced_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ, -- Soft delete support
    restored_at TIMESTAMPTZ,
    transaction_date DATE NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. WALLET LEDGER TABLE
CREATE TABLE wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    previous_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(12, 2) NOT NULL, -- Credit: positive, Debit: negative
    running_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ledger_type TEXT NOT NULL CHECK (ledger_type IN ('opening', 'transaction', 'transfer', 'adjustment')),
    notes VARCHAR(300),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. CASH LEDGER TABLE
CREATE TABLE cash_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    previous_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(12, 2) NOT NULL, -- Credit: positive, Debit: negative
    running_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ledger_type TEXT NOT NULL CHECK (ledger_type IN ('opening', 'transaction', 'transfer', 'adjustment')),
    notes VARCHAR(300),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. SETTINGS TABLE
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_wallet_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for authenticated users)
CREATE POLICY "Allow all for authenticated users" ON wallets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON service_wallet_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON wallet_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON wallet_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON cash_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_service_id ON transactions(service_id);
CREATE INDEX idx_transactions_deleted_at ON transactions(deleted_at);
CREATE INDEX idx_transactions_is_deleted ON transactions(is_deleted);
CREATE INDEX idx_transactions_transaction_number ON transactions(transaction_number);
CREATE INDEX idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_transfer_id ON transactions(transfer_id);

CREATE INDEX idx_wallet_ledger_wallet_id ON wallet_ledger(wallet_id);
CREATE INDEX idx_wallet_ledger_transaction_id ON wallet_ledger(transaction_id);
CREATE INDEX idx_wallet_ledger_created_at ON wallet_ledger(created_at);

CREATE INDEX idx_cash_ledger_transaction_id ON cash_ledger(transaction_id);
CREATE INDEX idx_cash_ledger_created_at ON cash_ledger(created_at);

CREATE INDEX idx_wallet_transfers_source ON wallet_transfers(source_wallet_id);
CREATE INDEX idx_wallet_transfers_dest ON wallet_transfers(destination_wallet_id);
CREATE INDEX idx_wallet_transfers_created_at ON wallet_transfers(created_at);

-- TRIGGERS FOR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_wallet_transfers_updated_at BEFORE UPDATE ON wallet_transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER TO AUTOMATICALLY SET transaction_date FROM created_at
CREATE OR REPLACE FUNCTION set_transaction_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.transaction_date := COALESCE(NEW.transaction_date, NEW.created_at::date);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_transaction_date BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION set_transaction_date();

-- SEED DATA FOR SERVICES
INSERT INTO services (id, name, type, color, is_active, sort_order, quick_amounts, requires_wallet_selection) VALUES
('e18b0cbb-1a6e-4266-af61-6c9ec11dedad', 'Jio Recharge', 'jio_recharge', '#0f3cc9', true, 1, ARRAY[149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], true),
('a0f7e4df-cb1b-4f9e-a89e-2dc32e2fb420', 'Airtel Recharge', 'airtel_recharge', '#e21226', true, 2, ARRAY[149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], true),
('d6e8790b-6a15-4fa0-82a1-12c8a0c20ab8', 'VI Recharge', 'vi_recharge', '#eb0029', true, 3, ARRAY[149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], true),
('f0a202d9-1b32-47de-a89a-dc2cf9bc10ab', 'BSNL Recharge', 'bsnl_recharge', '#0f68b3', true, 4, ARRAY[149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], true),
('b861219b-c40d-4560-84a2-2ab74d4715bd', 'AEPS Cash Withdrawal', 'aeps_withdrawal', '#10b981', true, 5, ARRAY[500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000], false),
('a3746c82-126c-48be-88e9-abfcd651121d', 'Money Transfer', 'money_transfer', '#3b82f6', true, 6, ARRAY[500, 1000, 1500, 2000, 2500, 3000, 5000, 7000, 10000], false),
('c1ab8d09-1a22-4844-88d9-2f2ab237cb01', 'Electricity Bill Payment', 'electricity_bill', '#0d9488', true, 7, ARRAY[]::integer[], true),
('d86212ea-c9be-482d-88b9-fbcd812ab2bd', 'Balance Enquiry', 'balance_enquiry', '#f97316', true, 8, ARRAY[]::integer[], false),
('f81ab230-1cba-4bb1-88f9-abcd3a401cba', 'Loan Repayment', 'loan_repayment', '#8b5cf6', true, 9, ARRAY[]::integer[], true);

-- SEED DATA FOR SHOP SETTINGS
INSERT INTO settings (key, value) VALUES
('shop_name', '"BHAWANI ENTERPRISES"'),
('setup_completed', 'false'),
('shop_logo', '""');
