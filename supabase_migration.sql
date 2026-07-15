-- Incremental Supabase Migration Script
-- Run this in the Supabase SQL Editor to update your existing database safely.

-- 1. Create Wallet Transfers Table (if not exists)
CREATE TABLE IF NOT EXISTS wallet_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    destination_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    notes VARCHAR(300),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for wallet_transfers
ALTER TABLE wallet_transfers ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'wallet_transfers' AND policyname = 'Allow all for authenticated users'
    ) THEN
        CREATE POLICY "Allow all for authenticated users" ON wallet_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- 2. Alter notes columns to VARCHAR(300) in ledger and transaction tables
ALTER TABLE transactions ALTER COLUMN notes TYPE VARCHAR(300);
ALTER TABLE wallet_ledger ALTER COLUMN notes TYPE VARCHAR(300);
ALTER TABLE cash_ledger ALTER COLUMN notes TYPE VARCHAR(300);

-- 3. Extend wallets table with provider and appearance columns
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'Other' CHECK (provider IN ('FINO', 'PhonePe', 'Google Pay', 'Spice Money', 'Other'));
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS color TEXT;

-- 4. Extend transactions table with direction, soft delete, optimization, and auditing columns
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('CREDIT', 'DEBIT'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_date DATE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_id UUID REFERENCES wallet_transfers(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by UUID;

-- 5. Extend wallet_ledger table with running balances and auditing columns
ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS previous_balance NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS running_balance NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS created_by UUID;

-- 6. Extend cash_ledger table with running cash and auditing columns
ALTER TABLE cash_ledger ADD COLUMN IF NOT EXISTS previous_cash NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE cash_ledger ADD COLUMN IF NOT EXISTS running_cash NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE cash_ledger ADD COLUMN IF NOT EXISTS created_by UUID;

-- 7. Add Database Constraints
-- Transaction amount must be >= 0 (since Balance Enquiry is 0, others > 0)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_amount;
ALTER TABLE transactions ADD CONSTRAINT chk_transactions_amount CHECK (amount >= 0);

-- Wallet and service name validation
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS chk_wallets_name;
ALTER TABLE wallets ADD CONSTRAINT chk_wallets_name CHECK (length(trim(name)) > 0);

ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_name;
ALTER TABLE services ADD CONSTRAINT chk_services_name CHECK (length(trim(name)) > 0);

-- 8. Create Foreign Key and Query Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_service_id ON transactions(service_id);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON transactions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_is_deleted ON transactions(is_deleted);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_number ON transactions(transaction_number);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_id ON transactions(transfer_id);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_wallet_id ON wallet_ledger(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_transaction_id ON wallet_ledger(transaction_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_created_at ON wallet_ledger(created_at);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_transaction_id ON cash_ledger(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_created_at ON cash_ledger(created_at);

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_source ON wallet_transfers(source_wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_dest ON wallet_transfers(destination_wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_created_at ON wallet_transfers(created_at);

-- 9. Automatic updated_at Trigger Setup
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_update_wallets_updated_at ON wallets;
CREATE TRIGGER trigger_update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_services_updated_at ON services;
CREATE TRIGGER trigger_update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_transactions_updated_at ON transactions;
CREATE TRIGGER trigger_update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_settings_updated_at ON settings;
CREATE TRIGGER trigger_update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_wallet_transfers_updated_at ON wallet_transfers;
CREATE TRIGGER trigger_update_wallet_transfers_updated_at BEFORE UPDATE ON wallet_transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Trigger to automatically set transaction_date from created_at
CREATE OR REPLACE FUNCTION set_transaction_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.transaction_date := COALESCE(NEW.transaction_date, NEW.created_at::date);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_transaction_date ON transactions;
CREATE TRIGGER trigger_set_transaction_date BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION set_transaction_date();

-- 11. Seed updates: Add default Money Transfer quick amounts
UPDATE services 
SET quick_amounts = ARRAY[500, 1000, 1500, 2000, 2500, 3000, 5000, 7000, 10000]
WHERE type = 'money_transfer';
