import Dexie, { type Table } from 'dexie';

// Interfaces mapping 1:1 with database tables
export interface Wallet {
  id: string; // UUID
  name: string;
  provider: 'FINO' | 'PhonePe' | 'Google Pay' | 'Spice Money' | 'Other';
  icon?: string | null;
  color?: string | null;
  is_active: number; // 1 for true, 0 for false (Dexie/IndexedDB queries work better with numbers for indexing)
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string; // UUID
  name: string;
  type: string;
  logo_url?: string;
  color?: string;
  is_active: number; // 1 for true, 0 for false
  sort_order: number;
  quick_amounts: number[];
  requires_wallet_selection: number; // 1 for true, 0 for false
  created_at: string;
  updated_at: string;
}

export interface ServiceWalletRule {
  id: string; // UUID
  service_id: string;
  wallet_id: string | null; // NULL represents cash or dynamic selection
  action: 'DEBIT' | 'CREDIT';
  direction: 'WALLET' | 'CASH';
  priority: number;
  created_at: string;
}

export interface WalletTransfer {
  id: string; // UUID
  source_wallet_id: string | null; // NULL represents CASH
  destination_wallet_id: string | null; // NULL represents CASH
  amount: number;
  notes: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string; // UUID
  service_id: string | null;
  wallet_id: string | null;
  transfer_id: string | null;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  notes: string | null;
  commission: number;
  transaction_number: string;
  status: 'pending' | 'synced';
  synced: number; // 1 for true, 0 for false
  created_local: number; // 1 for true, 0 for false
  synced_at: string | null;
  is_deleted: number; // 1 for true, 0 for false
  deleted_at: string | null; // Soft delete timestamp
  restored_at: string | null;
  transaction_date: string; // YYYY-MM-DD local format
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletLedger {
  id: string; // UUID
  wallet_id: string;
  transaction_id: string | null;
  previous_balance: number;
  amount: number; // Credit positive, Debit negative
  running_balance: number;
  ledger_type: 'opening' | 'transaction' | 'transfer' | 'adjustment';
  notes: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface CashLedger {
  id: string; // UUID
  transaction_id: string | null;
  previous_cash: number;
  amount: number; // Credit positive, Debit negative
  running_cash: number;
  ledger_type: 'opening' | 'transaction' | 'transfer' | 'adjustment';
  notes: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface Setting {
  key: string;
  value: unknown; // Stored as JSON or simple types
  created_at: string;
  updated_at: string;
}

export interface SyncItem {
  id?: number; // Auto-incrementing local ID
  table: string; // 'wallets' | 'services' | 'service_wallet_rules' | 'transactions' | 'wallet_ledger' | 'cash_ledger' | 'settings' | 'wallet_transfers'
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: unknown;
  key: string; // The primary key (id or key)
  timestamp: number;
}

// Dexie Class Definition
class BhawaniDB extends Dexie {
  wallets!: Table<Wallet, string>;
  services!: Table<Service, string>;
  service_wallet_rules!: Table<ServiceWalletRule, string>;
  wallet_transfers!: Table<WalletTransfer, string>;
  transactions!: Table<Transaction, string>;
  wallet_ledger!: Table<WalletLedger, string>;
  cash_ledger!: Table<CashLedger, string>;
  settings!: Table<Setting, string>;
  sync_queue!: Table<SyncItem, number>;

  constructor() {
    super('BhawaniDB');
    
    // Define database stores (v4 schema)
    this.version(4).stores({
      wallets: 'id, name, provider, is_active, sort_order',
      services: 'id, type, is_active, sort_order',
      service_wallet_rules: 'id, service_id, wallet_id',
      wallet_transfers: 'id, source_wallet_id, destination_wallet_id, created_at',
      transactions: 'id, service_id, wallet_id, transfer_id, transaction_number, transaction_date, synced, is_deleted, created_at, commission',
      wallet_ledger: 'id, wallet_id, transaction_id, ledger_type, created_at',
      cash_ledger: 'id, transaction_id, ledger_type, created_at',
      settings: 'key',
      sync_queue: '++id, [table+key], table, action, timestamp'
    });
  }
}

export const db = new BhawaniDB();
