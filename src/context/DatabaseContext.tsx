'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { db, type Wallet, type Service, type ServiceWalletRule, type Transaction, type WalletLedger, type CashLedger, type Setting, type SyncItem, type WalletTransfer } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/context/AuthContext';

interface DatabaseContextType {
  isOnline: boolean;
  syncStatus: 'synced' | 'pending' | 'local_only';
  lastSyncError: string | null;
  wallets: Wallet[];
  services: Service[];
  transactions: Transaction[];
  cashBalance: number;
  walletBalances: Record<string, number>;
  settings: Record<string, unknown>;
  isLoaded: boolean;
  
  // Actions
  saveTransaction: (serviceId: string, amount: number, walletId: string | null, commission: number) => Promise<Transaction>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  restoreTransaction: (transactionId: string) => Promise<void>;
  adjustWalletBalance: (walletId: string | 'CASH', action: 'add' | 'deduct', amount: number, commission: number) => Promise<void>;
  transferWallets: (sourceWalletId: string | 'CASH', destWalletId: string | 'CASH', amount: number, notes: string) => Promise<void>;
  updateSetting: (key: string, value: unknown) => Promise<void>;
  getSuggestedCommission: (serviceType: string, amount: number) => number;
  editTransaction: (transactionId: string, amount: number, walletId: string | null, commission: number) => Promise<void>;
  
  // Wallet CRUD
  addWallet: (name: string, provider: Wallet['provider'], icon: string | null, color: string | null) => Promise<string>;
  editWallet: (id: string, name: string, provider: Wallet['provider'], icon: string | null, color: string | null, sortOrder: number, isActive: boolean) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;
  reorderWallets: (walletIds: string[]) => Promise<void>;

  // Service CRUD / settings
  updateServiceConfig: (id: string, name: string, color: string, is_active: boolean, sort_order: number, quick_amounts: number[], requires_wallet_selection: boolean) => Promise<void>;

  // Setup
  finishSetup: (openingCash: number, walletBalances: { name: string; balance: number }[]) => Promise<void>;
  pullLatest: () => Promise<void>;
  runSyncWorker: () => Promise<void>;
  wipeAllData: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  // Monitor online status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Determine sync status based on queue length and supabase configuration
  const queueLength = useLiveQuery(() => db.sync_queue.count()) || 0;

  const syncStatus = React.useMemo<'synced' | 'pending' | 'local_only'>(() => {
    if (!isSupabaseConfigured()) {
      return 'local_only';
    } else if (queueLength > 0) {
      return 'pending';
    } else {
      return 'synced';
    }
  }, [queueLength]);

  // Live queries for tables
  const walletsRaw = useLiveQuery(async () => {
    const list = await db.wallets.where('is_active').equals(1).toArray();
    return list.sort((a, b) => a.sort_order - b.sort_order);
  });
  const wallets = walletsRaw || [];

  const allWalletsForAdminRaw = useLiveQuery(() => db.wallets.orderBy('sort_order').toArray());
  const allWalletsForAdmin = allWalletsForAdminRaw || [];

  const servicesRaw = useLiveQuery(async () => {
    const list = await db.services.where('is_active').equals(1).toArray();
    return list.sort((a, b) => a.sort_order - b.sort_order);
  });
  const services = servicesRaw || [];

  const allServicesForAdminRaw = useLiveQuery(() => db.services.orderBy('sort_order').toArray());
  const allServicesForAdmin = allServicesForAdminRaw || [];

  const transactionsRaw = useLiveQuery(() => db.transactions.orderBy('created_at').reverse().toArray());
  const transactions = transactionsRaw || [];

  const rawSettingsRaw = useLiveQuery(() => db.settings.toArray());
  const rawSettings = rawSettingsRaw || [];

  const walletLedgerRaw = useLiveQuery(() => db.wallet_ledger.toArray());
  const walletLedger = walletLedgerRaw || [];

  const cashLedgerRaw = useLiveQuery(() => db.cash_ledger.toArray());
  const cashLedger = cashLedgerRaw || [];

  // Convert rawSettings array to key-value record
  const settings = React.useMemo(() => {
    return rawSettings.reduce<Record<string, unknown>>((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  }, [rawSettings]);

  // Local time date helpers
  const getLocalDDMMYYYY = (date: Date = new Date()) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}${m}${y}`;
  };

  const getLocalYYYYMMDD = (date: Date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Recalculate Wallet Ledger Balances
  const recalculateWalletBalances = async (walletId: string) => {
    const rawEntries = await db.wallet_ledger.where('wallet_id').equals(walletId).toArray();
    const entries = rawEntries.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const txs = await db.transactions.toArray();
    const activeTxIds = new Set<string>();
    txs.forEach(t => {
      if (t.is_deleted === 0) {
        activeTxIds.add(t.id);
      }
    });

    let currentBal = 0;
    for (const entry of entries) {
      const isTxActive = entry.transaction_id === null || activeTxIds.has(entry.transaction_id);
      const effectiveAmount = isTxActive ? entry.amount : 0;

      const prevBal = currentBal;
      const runBal = currentBal + effectiveAmount;
      currentBal = runBal;

      if (entry.previous_balance !== prevBal || entry.running_balance !== runBal) {
        // BUG 11 FIX: running_balance is a derived field — update locally only, do NOT queue for sync
        await db.wallet_ledger.update(entry.id, {
          previous_balance: prevBal,
          running_balance: runBal
        });
      }
    }
  };

  // Recalculate Cash Ledger Balances
  const recalculateCashBalances = async () => {
    const rawEntries = await db.cash_ledger.toArray();
    const entries = rawEntries.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const txs = await db.transactions.toArray();
    const activeTxIds = new Set<string>();
    txs.forEach(t => {
      if (t.is_deleted === 0) {
        activeTxIds.add(t.id);
      }
    });

    let currentCash = 0;
    for (const entry of entries) {
      const isTxActive = entry.transaction_id === null || activeTxIds.has(entry.transaction_id);
      const effectiveAmount = isTxActive ? entry.amount : 0;

      const prevCash = currentCash;
      const runCash = currentCash + effectiveAmount;
      currentCash = runCash;

      if (entry.previous_cash !== prevCash || entry.running_cash !== runCash) {
        // BUG 11 FIX: running_cash is a derived field — update locally only, do NOT queue for sync
        await db.cash_ledger.update(entry.id, {
          previous_cash: prevCash,
          running_cash: runCash
        });
      }
    }
  };

  // Calculate balances autoritatively: Using stored running balances
  const { cashBalance, walletBalances } = React.useMemo(() => {
    let cash = 0;
    if (cashLedger.length > 0) {
      const sortedCash = [...cashLedger].sort((a, b) => a.created_at.localeCompare(b.created_at));
      cash = sortedCash[sortedCash.length - 1]?.running_cash || 0;
    }

    const wBalances: Record<string, number> = {};
    allWalletsForAdmin.forEach(w => {
      wBalances[w.id] = 0;
    });

    const latestEntries: Record<string, WalletLedger> = {};
    walletLedger.forEach(entry => {
      const existing = latestEntries[entry.wallet_id];
      if (!existing || entry.created_at.localeCompare(existing.created_at) > 0) {
        latestEntries[entry.wallet_id] = entry;
      }
    });

    Object.keys(latestEntries).forEach(wId => {
      wBalances[wId] = latestEntries[wId].running_balance || 0;
    });

    return {
      cashBalance: cash,
      walletBalances: wBalances
    };
  }, [cashLedger, walletLedger, allWalletsForAdmin]);

  // Safe device vibration
  const triggerVibration = () => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  // Generate sequential transaction number in DDMMYYYY-XXX format (restarts daily)
  const generateNextTransactionNumber = async (): Promise<string> => {
    const dateStr = getLocalDDMMYYYY();
    const prefix = `${dateStr}-`;
    const txs = await db.transactions
      .where('transaction_number')
      .startsWith(prefix)
      .toArray();

    let maxSeq = 0;
    txs.forEach(tx => {
      const parts = tx.transaction_number.split('-');
      if (parts.length === 2) {
        const seq = parseInt(parts[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  };

  // Push task to sync queue
  const queueSync = async (table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', key: string, data: unknown) => {
    if (!isSupabaseConfigured()) return;
    
    // Check if there is already a sync item for this key in this table to prevent redundant work
    const existing = await db.sync_queue
      .where('[table+key]')
      .equals([table, key])
      .first();

    if (existing) {
      if (action === 'DELETE') {
        // If we are deleting a newly created local record that hasn't synced, we can just delete the insert job
        if (existing.action === 'INSERT') {
          await db.sync_queue.delete(existing.id!);
          return;
        }
        await db.sync_queue.update(existing.id!, { action: 'DELETE', data, timestamp: Date.now() });
      } else {
        // Update existing sync item data
        await db.sync_queue.update(existing.id!, { data, timestamp: Date.now() });
      }
    } else {
      await db.sync_queue.add({
        table,
        action,
        data,
        key,
        timestamp: Date.now()
      });
    }
  };

  // Background Sync Queue Worker
  const runSyncWorker = useCallback(async () => {
    if (!isOnline || !isSupabaseConfigured() || !supabase) return;

    try {
      const queue = await db.sync_queue.orderBy('timestamp').toArray();
      if (queue.length === 0) return;

      for (const item of queue) {
        const pkCol = item.table === 'settings' ? 'key' : 'id';
        let success = false;
        
        if (item.action === 'INSERT' || item.action === 'UPDATE') {
          // Clean data if needed
          const syncData = { ...(item.data as Record<string, unknown>) };
          
          // Remove local-only fields that do not exist in remote PostgreSQL tables
          if (item.table === 'transactions') {
            delete syncData.created_local;
          } else if (item.table === 'wallet_ledger') {
            delete syncData.notes;
            delete syncData.ledger_type;
            delete syncData.created_by;
          } else if (item.table === 'cash_ledger') {
            delete syncData.notes;
            delete syncData.ledger_type;
            delete syncData.created_by;
          } else if (item.table === 'wallets') {
            delete syncData.balance;
          }

          // Convert boolean numbers to true boolean for PG database compatibility
          if ('is_active' in syncData) syncData.is_active = syncData.is_active === 1;
          if ('requires_wallet_selection' in syncData) syncData.requires_wallet_selection = syncData.requires_wallet_selection === 1;
          if ('is_deleted' in syncData) syncData.is_deleted = syncData.is_deleted === 1;
          if ('synced' in syncData) syncData.synced = true; // Mark synced on remote

          const { error } = await supabase.from(item.table).upsert(syncData);
          if (!error) {
            success = true;
          } else {
            const msg = `Upsert failed for table '${item.table}' (${item.key}): ${error.message} (${error.code || ''})`;
            console.error(msg, error);
            setLastSyncError(msg);
          }
        } else if (item.action === 'DELETE') {
          const { error } = await supabase.from(item.table).delete().eq(pkCol, item.key);
          if (!error) {
            success = true;
          } else {
            const msg = `Delete failed for table '${item.table}' (${item.key}): ${error.message} (${error.code || ''})`;
            console.error(msg, error);
            setLastSyncError(msg);
          }
        }

        if (success) {
          await db.sync_queue.delete(item.id!);
          setLastSyncError(null);
          
          // If transaction synced, update its state locally
          if (item.table === 'transactions') {
            await db.transactions.update(item.key, {
              status: 'synced',
              synced: 1,
              synced_at: new Date().toISOString()
            });
          }
        } else {
          // If a sync fails, stop queue processing to maintain transaction ordering
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown sync error';
      console.error('Error in sync worker:', err);
      setLastSyncError(msg);
    }
  }, [isOnline]);

  // Pull latest updates from Supabase
  const pullLatest = useCallback(async () => {
    if (!isOnline || !isSupabaseConfigured() || !supabase) return;

    try {
      // BUG 8 FIX: Do NOT block pull on pending queue items.
      // Push (runSyncWorker) and Pull (pullLatest) are independent operations.
      // Blocking pull while push fails creates a permanent deadlock.

      // 1. Pull settings
      const { data: sData } = await supabase.from('settings').select('*');
      if (sData) {
        for (const item of sData) {
          await db.settings.put({
            key: item.key,
            value: item.value,
            created_at: item.created_at,
            updated_at: item.updated_at
          });
        }
      }

      // 2. Pull wallets
      const { data: wData } = await supabase.from('wallets').select('*');
      if (wData) {
        for (const item of wData) {
          await db.wallets.put({
            id: item.id,
            name: item.name,
            provider: item.provider,
            icon: item.icon,
            color: item.color,
            is_active: item.is_active ? 1 : 0,
            sort_order: item.sort_order,
            created_at: item.created_at,
            updated_at: item.updated_at
          });
        }
      }

      // 3. Pull services
      const { data: svData } = await supabase.from('services').select('*');
      if (svData) {
        for (const item of svData) {
          await db.services.put({
            id: item.id,
            name: item.name,
            type: item.type,
            logo_url: item.logo_url || undefined,
            color: item.color || undefined,
            is_active: item.is_active ? 1 : 0,
            sort_order: item.sort_order,
            quick_amounts: item.quick_amounts,
            requires_wallet_selection: item.requires_wallet_selection ? 1 : 0,
            created_at: item.created_at,
            updated_at: item.updated_at
          });
        }
      }

      // 4. Pull service rules
      const { data: ruleData } = await supabase.from('service_wallet_rules').select('*');
      if (ruleData) {
        await db.service_wallet_rules.clear();
        for (const item of ruleData) {
          await db.service_wallet_rules.put(item);
        }
      }

      // 5. Pull wallet transfers
      const { data: wtData } = await supabase.from('wallet_transfers').select('*');
      if (wtData) {
        for (const item of wtData) {
          await db.wallet_transfers.put({
            id: item.id,
            source_wallet_id: item.source_wallet_id,
            destination_wallet_id: item.destination_wallet_id,
            amount: parseFloat(item.amount),
            notes: item.notes,
            created_by: item.created_by,
            created_at: item.created_at,
            updated_at: item.updated_at
          });
        }
      }

      // 6. Pull transactions
      const { data: txData } = await supabase.from('transactions').select('*');
      if (txData) {
        for (const item of txData) {
          await db.transactions.put({
            id: item.id,
            service_id: item.service_id,
            wallet_id: item.wallet_id,
            transfer_id: item.transfer_id,
            amount: parseFloat(item.amount),
            direction: item.direction,
            notes: item.notes,
            commission: parseFloat(item.commission || '0'),
            transaction_number: item.transaction_number,
            status: 'synced',
            synced: 1,
            created_local: item.created_local ? 1 : 0,
            synced_at: item.synced_at,
            is_deleted: item.is_deleted ? 1 : 0,
            deleted_at: item.deleted_at,
            restored_at: item.restored_at,
            transaction_date: item.transaction_date,
            created_by: item.created_by,
            created_at: item.created_at,
            updated_at: item.updated_at
          });
        }
      }

      // 7. Pull wallet ledger
      const { data: wlData } = await supabase.from('wallet_ledger').select('*');
      if (wlData) {
        for (const item of wlData) {
          await db.wallet_ledger.put({
            id: item.id,
            wallet_id: item.wallet_id,
            transaction_id: item.transaction_id,
            previous_balance: parseFloat(item.previous_balance || '0'),
            amount: parseFloat(item.amount),
            running_balance: parseFloat(item.running_balance || '0'),
            ledger_type: item.ledger_type,
            notes: item.notes,
            created_by: item.created_by,
            created_at: item.created_at
          });
        }
      }

      // 8. Pull cash ledger
      const { data: clData } = await supabase.from('cash_ledger').select('*');
      if (clData) {
        for (const item of clData) {
          await db.cash_ledger.put({
            id: item.id,
            transaction_id: item.transaction_id,
            previous_cash: parseFloat(item.previous_cash || '0'),
            amount: parseFloat(item.amount),
            running_cash: parseFloat(item.running_cash || '0'),
            ledger_type: item.ledger_type,
            notes: item.notes,
            created_by: item.created_by,
            created_at: item.created_at
          });
        }
      }
    } catch (err) {
      console.error('Error pulling from Supabase:', err);
    }
  }, [isOnline]);

  // Sync polling / event triggers
  useEffect(() => {
    if (isOnline) {
      runSyncWorker();
    }
  }, [isOnline, queueLength, runSyncWorker]);

  // Seed default services when the database is loaded and completely empty
  const initializeDatabase = async () => {
    try {
      const servicesCount = await db.services.count();
      const firstSvcArray = await db.services.limit(1).toArray();
      const firstSvc = firstSvcArray[0];
      // Self-heal: If database contains older service IDs generated by random UUIDs, clean them up
      const hasOldFormat = firstSvc && !['e18b0cbb-1a6e-4266-af61-6c9ec11dedad', 'a0f7e4df-cb1b-4f9e-a89e-2dc32e2fb420', 'd6e8790b-6a15-4fa0-82a1-12c8a0c20ab8', 'f0a202d9-1b32-47de-a89a-dc2cf9bc10ab', 'b861219b-c40d-4560-84a2-2ab74d4715bd', 'a3746c82-126c-48be-88e9-abfcd651121d', 'c1ab8d09-1a22-4844-88d9-2f2ab237cb01', 'd86212ea-c9be-482d-88b9-fbcd812ab2bd', 'f81ab230-1cba-4bb1-88f9-abcd3a401cba'].includes(firstSvc.id);

      if (servicesCount === 0 || hasOldFormat) {
        await db.services.clear();
        await db.service_wallet_rules.clear();
        
        // Seed services with static UUIDs for multi-device sync integrity
        const defaultServices: Service[] = [
          { id: 'e18b0cbb-1a6e-4266-af61-6c9ec11dedad', name: 'Jio Recharge', type: 'jio_recharge', color: '#0f3cc9', is_active: 1, sort_order: 1, quick_amounts: [149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'a0f7e4df-cb1b-4f9e-a89e-2dc32e2fb420', name: 'Airtel Recharge', type: 'airtel_recharge', color: '#e21226', is_active: 1, sort_order: 2, quick_amounts: [149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'd6e8790b-6a15-4fa0-82a1-12c8a0c20ab8', name: 'VI Recharge', type: 'vi_recharge', color: '#eb0029', is_active: 1, sort_order: 3, quick_amounts: [149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'f0a202d9-1b32-47de-a89a-dc2cf9bc10ab', name: 'BSNL Recharge', type: 'bsnl_recharge', color: '#0f68b3', is_active: 1, sort_order: 4, quick_amounts: [149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'b861219b-c40d-4560-84a2-2ab74d4715bd', name: 'AEPS Cash Withdrawal', type: 'aeps_withdrawal', color: '#10b981', is_active: 1, sort_order: 5, quick_amounts: [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000], requires_wallet_selection: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'a3746c82-126c-48be-88e9-abfcd651121d', name: 'Money Transfer', type: 'money_transfer', color: '#3b82f6', is_active: 1, sort_order: 6, quick_amounts: [500, 1000, 1500, 2000, 2500, 3000, 5000, 7000, 10000], requires_wallet_selection: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'c1ab8d09-1a22-4844-88d9-2f2ab237cb01', name: 'Electricity Bill Payment', type: 'electricity_bill', color: '#0d9488', is_active: 1, sort_order: 7, quick_amounts: [], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'd86212ea-c9be-482d-88b9-fbcd812ab2bd', name: 'Balance Enquiry', type: 'balance_enquiry', color: '#f97316', is_active: 1, sort_order: 8, quick_amounts: [], requires_wallet_selection: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'f81ab230-1cba-4bb1-88f9-abcd3a401cba', name: 'Loan Repayment', type: 'loan_repayment', color: '#8b5cf6', is_active: 1, sort_order: 9, quick_amounts: [], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ];
        for (const s of defaultServices) {
          await db.services.add(s);
        }
      }

      // Seed initial settings
      const settingsCount = await db.settings.count();
      if (settingsCount === 0) {
        await db.settings.add({ key: 'shop_name', value: 'BHAWANI ENTERPRISES', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        await db.settings.add({ key: 'setup_completed', value: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        await db.settings.add({ key: 'shop_logo', value: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }

      // Self-heal: Ensure default commission rules exist
      const hasCommRules = await db.settings.get('commission_rules');
      if (!hasCommRules) {
        const defaultRules = {
          recharge_default: 2,
          electricity_default: 5,
          aeps_slabs: [
            { min: 0, max: 1000, commission: 10 },
            { min: 1001, max: 2000, commission: 20 },
            { min: 2001, max: 3000, commission: 30 }
          ],
          transfer_slabs: [
            { min: 0, max: 1000, commission: 10 },
            { min: 1001, max: 2000, commission: 20 }
          ],
          loan_slabs: [
            { min: 0, max: 1000, commission: 10 },
            { min: 1001, max: 2000, commission: 20 }
          ]
        };
        const rulesSetting = {
          key: 'commission_rules',
          value: defaultRules,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await db.settings.add(rulesSetting);
        await queueSync('settings', 'INSERT', 'commission_rules', rulesSetting);
      }

      // Self-heal: Check and migrate "Fino Wallet" to "Fino(S)"
      const allWallets = await db.wallets.toArray();
      const finoWallet = allWallets.find(w => w.name.toLowerCase().trim() === 'fino wallet');
      if (finoWallet) {
        finoWallet.name = 'Fino(S)';
        finoWallet.updated_at = new Date().toISOString();
        await db.wallets.put(finoWallet);
        await queueSync('wallets', 'UPDATE', finoWallet.id, finoWallet);
      }

      // BUG 9 FIX: Only self-heal system wallets AFTER setup is complete.
      // If we seed wallets before setup, finishSetup() creates them again with new UUIDs → duplicates.
      const setupDoneSetting = await db.settings.get('setup_completed');
      const isSetupDone = setupDoneSetting?.value === true;

      if (isSetupDone) {
        // Self-heal: Ensure system wallets (Fino(S), Fino(N), SBI, PhonePe, Google Pay, Navi) exist
        const updatedWallets = await db.wallets.toArray();
        const systemWallets = [
          { name: 'Fino(S)', provider: 'FINO' as const, icon: 'fino', color: '#e21226', sort_order: 1 },
          { name: 'Fino(N)', provider: 'FINO' as const, icon: 'fino', color: '#e21226', sort_order: 2 },
          { name: 'SBI', provider: 'Other' as const, icon: 'landmark', color: '#0054a6', sort_order: 3 },
          { name: 'PhonePe', provider: 'PhonePe' as const, icon: 'phonepe', color: '#5f259f', sort_order: 10 },
          { name: 'Google Pay', provider: 'Google Pay' as const, icon: 'google-pay', color: '#1a73e8', sort_order: 11 },
          { name: 'Navi', provider: 'Other' as const, icon: 'landmark', color: '#0d9488', sort_order: 12 }
        ];
        for (const sysW of systemWallets) {
          if (!updatedWallets.some(w => w.name.toLowerCase().trim() === sysW.name.toLowerCase().trim())) {
            const newW: Wallet = {
              id: crypto.randomUUID(),
              name: sysW.name,
              provider: sysW.provider,
              icon: sysW.icon,
              color: sysW.color,
              is_active: 1,
              sort_order: sysW.sort_order,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            await db.wallets.add(newW);
            await queueSync('wallets', 'INSERT', newW.id, newW);
          }
        }
      }

      // If we are online, trigger an initial full sync from Supabase
      if (isOnline && isSupabaseConfigured()) {
        await pullLatest();
      }
    } catch (err) {
      console.error('Failed to initialize database:', err);
    } finally {
      setIsLoaded(true);
    }
  };

  // Run initial db load
  useEffect(() => {
    initializeDatabase();
  }, []);

  // Trigger a full pull from Supabase when the user logs in on a new device
  useEffect(() => {
    const handleAuthTransition = async () => {
      if (isAuthenticated && isOnline && isSupabaseConfigured()) {
        setIsLoaded(false);
        try {
          await pullLatest();
        } catch (err) {
          console.error('Failed to pull on login transition:', err);
        } finally {
          setIsLoaded(true);
        }
      }
    };
    handleAuthTransition();
  }, [isAuthenticated, isOnline, pullLatest]);

  // Polling sync to pull updates from Supabase every 10 seconds
  useEffect(() => {
    if (!isOnline || !isSupabaseConfigured() || !isAuthenticated) return;

    const interval = setInterval(async () => {
      try {
        // 1. Process sync queue first if it has items
        const count = await db.sync_queue.count();
        if (count > 0) {
          await runSyncWorker();
        }

        // 2. Only pull if there are no local pending modifications to prevent conflicts
        const finalCount = await db.sync_queue.count();
        if (finalCount === 0) {
          await pullLatest();
        }
      } catch (err) {
        console.error('Error in periodic sync pull/push:', err);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [isOnline, isAuthenticated, pullLatest, runSyncWorker]);

  // Suggested Commission Engine
  const getSuggestedCommission = useCallback((serviceType: string, amount: number): number => {
    const rules = (settings.commission_rules as any) || {
      recharge_default: 2,
      electricity_default: 5,
      aeps_slabs: [],
      transfer_slabs: [],
      loan_slabs: []
    };

    const cleanType = serviceType.toLowerCase();

    if (cleanType.includes('recharge')) {
      return Number(rules.recharge_default) || 0;
    }
    if (cleanType === 'electricity_bill') {
      return Number(rules.electricity_default) || 0;
    }
    
    let slabs: Array<{ min: number; max: number; commission: number }> = [];
    if (cleanType === 'aeps_withdrawal') {
      slabs = rules.aeps_slabs || [];
    } else if (cleanType === 'money_transfer') {
      slabs = rules.transfer_slabs || [];
    } else if (cleanType === 'loan_repayment') {
      slabs = rules.loan_slabs || [];
    }

    const matchedSlab = slabs.find(s => amount >= s.min && amount <= s.max);
    return matchedSlab ? Number(matchedSlab.commission) : 0;
  }, [settings]);

  // Save Transaction Function
  const saveTransaction = async (
    serviceId: string,
    amount: number,
    walletId: string | null,
    commission: number
  ): Promise<Transaction> => {
    triggerVibration();

    const transactionId = crypto.randomUUID();
    const txNumber = await generateNextTransactionNumber();
    const nowStr = new Date().toISOString();
    const dateStr = getLocalYYYYMMDD();

    const service = await db.services.get(serviceId);
    if (!service) throw new Error(`Service ${serviceId} not found`);

    // Amount validation
    const isEnquiry = service.type === 'balance_enquiry';
    if (!isEnquiry && amount <= 0) {
      throw new Error('Transaction amount must be greater than 0');
    }

    const direction = (service.type === 'aeps_withdrawal' || service.type === 'balance_enquiry') ? 'CREDIT' : 'DEBIT';

    const newTx: Transaction = {
      id: transactionId,
      service_id: serviceId,
      wallet_id: walletId,
      transfer_id: null,
      amount,
      direction,
      notes: null,
      commission,
      transaction_number: txNumber,
      status: 'pending',
      synced: 0,
      created_local: 1,
      synced_at: null,
      is_deleted: 0,
      deleted_at: null,
      restored_at: null,
      transaction_date: dateStr,
      created_at: nowStr,
      updated_at: nowStr
    };

    // Database transactional write
    await db.transaction('rw', [
      db.transactions,
      db.wallet_ledger,
      db.cash_ledger,
      db.service_wallet_rules,
      db.sync_queue,
      db.wallets
    ], async () => {
      await db.transactions.add(newTx);
      await queueSync('transactions', 'INSERT', transactionId, newTx);

      // Fetch rules for this service
      const rawRules = await db.service_wallet_rules
        .where('service_id')
        .equals(serviceId)
        .toArray();
      const rules = rawRules.sort((a, b) => (a.priority || 0) - (b.priority || 0));

      for (const rule of rules) {
        // Calculate factor based on DEBIT or CREDIT
        const factor = rule.action === 'DEBIT' ? -1 : 1;
        const entryAmount = amount * factor;

        if (rule.direction === 'CASH') {
          const latestCash = await db.cash_ledger.orderBy('created_at').last();
          const prevCash = latestCash?.running_cash || 0;

          const cashEntry: CashLedger = {
            id: crypto.randomUUID(),
            transaction_id: transactionId,
            previous_cash: prevCash,
            amount: entryAmount,
            running_cash: prevCash + entryAmount,
            ledger_type: 'transaction',
            notes: `${service.name} transaction`,
            created_at: nowStr
          };
          await db.cash_ledger.add(cashEntry);
          await queueSync('cash_ledger', 'INSERT', cashEntry.id, cashEntry);
        } else {
          // Mapped wallet id from rule or dynamically selected wallet
          const mappedWalletId = rule.wallet_id || walletId;
          if (mappedWalletId) {
            // Find SBI wallet ID to redirect UPI transactions
            const sbiWallet = await db.wallets.filter(w => w.name.toLowerCase().trim() === 'sbi').first();
            const sbiWalletId = sbiWallet?.id;

            let targetWalletIdForLedger = mappedWalletId;
            const selectedW = await db.wallets.get(mappedWalletId);
            if (selectedW && ['phonepe', 'google pay', 'gpay', 'navi'].includes(selectedW.name.toLowerCase().trim()) && sbiWalletId) {
              targetWalletIdForLedger = sbiWalletId;
            }

            const latestWallet = await db.wallet_ledger.where('wallet_id').equals(targetWalletIdForLedger).sortBy('created_at');
            const prevBal = latestWallet.length > 0 ? latestWallet[latestWallet.length - 1].running_balance : 0;

            const walletEntry: WalletLedger = {
              id: crypto.randomUUID(),
              wallet_id: targetWalletIdForLedger,
              transaction_id: transactionId,
              previous_balance: prevBal,
              amount: entryAmount,
              running_balance: prevBal + entryAmount,
              ledger_type: 'transaction',
              notes: `${service.name} transaction`,
              created_at: nowStr
            };
            await db.wallet_ledger.add(walletEntry);
            await queueSync('wallet_ledger', 'INSERT', walletEntry.id, walletEntry);
          }
        }
      }
    });

    // Recalculate running balances to be absolutely consistent
    if (walletId) {
      // Find SBI wallet ID to redirect UPI transactions
      const sbiWallet = await db.wallets.filter(w => w.name.toLowerCase().trim() === 'sbi').first();
      const sbiWalletId = sbiWallet?.id;

      const selectedW = await db.wallets.get(walletId);
      if (selectedW && ['phonepe', 'google pay', 'gpay', 'navi'].includes(selectedW.name.toLowerCase().trim()) && sbiWalletId) {
        await recalculateWalletBalances(sbiWalletId);
      } else {
        await recalculateWalletBalances(walletId);
      }
    }
    await recalculateCashBalances();

    // Run sync asynchronously
    runSyncWorker();
    return newTx;
  };

  // Soft Delete Transaction
  const deleteTransaction = async (transactionId: string) => {
    triggerVibration();
    const nowStr = new Date().toISOString();
    const tx = await db.transactions.get(transactionId);
    if (!tx) return;

    const updatedTx = { ...tx, is_deleted: 1, deleted_at: nowStr, updated_at: nowStr };

    await db.transaction('rw', [db.transactions, db.sync_queue], async () => {
      await db.transactions.update(transactionId, { is_deleted: 1, deleted_at: nowStr, updated_at: nowStr });
      await queueSync('transactions', 'UPDATE', transactionId, updatedTx);
    });

    // Recalculate balances sequentially (ledger entries from deleted transactions will count as 0 balance change)
    if (tx.wallet_id) {
      const sbiWallet = await db.wallets.filter(w => w.name.toLowerCase().trim() === 'sbi').first();
      const sbiWalletId = sbiWallet?.id;

      const selectedW = await db.wallets.get(tx.wallet_id);
      if (selectedW && ['phonepe', 'google pay', 'gpay', 'navi'].includes(selectedW.name.toLowerCase().trim()) && sbiWalletId) {
        await recalculateWalletBalances(sbiWalletId);
      } else {
        await recalculateWalletBalances(tx.wallet_id);
      }
    }
    await recalculateCashBalances();

    runSyncWorker();
  };

  // Restore Transaction
  const restoreTransaction = async (transactionId: string) => {
    triggerVibration();
    const nowStr = new Date().toISOString();
    const tx = await db.transactions.get(transactionId);
    if (!tx) return;

    const updatedTx = { ...tx, is_deleted: 0, deleted_at: null, restored_at: nowStr, updated_at: nowStr };

    await db.transaction('rw', [db.transactions, db.sync_queue], async () => {
      await db.transactions.update(transactionId, { is_deleted: 0, deleted_at: null, restored_at: nowStr, updated_at: nowStr });
      await queueSync('transactions', 'UPDATE', transactionId, updatedTx);
    });

    // Recalculate balances sequentially to restore original ledger effects
    if (tx.wallet_id) {
      const sbiWallet = await db.wallets.filter(w => w.name.toLowerCase().trim() === 'sbi').first();
      const sbiWalletId = sbiWallet?.id;

      const selectedW = await db.wallets.get(tx.wallet_id);
      if (selectedW && ['phonepe', 'google pay', 'gpay', 'navi'].includes(selectedW.name.toLowerCase().trim()) && sbiWalletId) {
        await recalculateWalletBalances(sbiWalletId);
      } else {
        await recalculateWalletBalances(tx.wallet_id);
      }
    }
    await recalculateCashBalances();

    runSyncWorker();
  };

  // Edit Transaction (Recalculate balances and update ledger entries chronologically)
  const editTransaction = async (
    transactionId: string,
    newAmount: number,
    newWalletId: string | null,
    newCommission: number
  ) => {
    triggerVibration();
    const nowStr = new Date().toISOString();
    const tx = await db.transactions.get(transactionId);
    if (!tx) throw new Error('Transaction not found');

    const oldWalletId = tx.wallet_id;

    await db.transaction('rw', [
      db.transactions,
      db.wallet_ledger,
      db.cash_ledger,
      db.sync_queue,
      db.services,
      db.service_wallet_rules,
      db.wallets
    ], async () => {
      // Update transaction fields
      const updatedTx = {
        ...tx,
        amount: newAmount,
        wallet_id: newWalletId,
        commission: newCommission,
        updated_at: nowStr
      };
      await db.transactions.put(updatedTx);
      await queueSync('transactions', 'UPDATE', transactionId, updatedTx);

      // Clean up previous ledger entries for this transaction
      await db.wallet_ledger.where('transaction_id').equals(transactionId).delete();
      await db.cash_ledger.where('transaction_id').equals(transactionId).delete();

      // Check if it is a service transaction or direct wallet adjustment
      if (tx.service_id) {
        const service = await db.services.get(tx.service_id);
        if (service) {
          const rawRules = await db.service_wallet_rules
            .where('service_id')
            .equals(service.id)
            .toArray();
          const rules = rawRules.sort((a, b) => (a.priority || 0) - (b.priority || 0));

          for (const rule of rules) {
            const factor = rule.action === 'DEBIT' ? -1 : 1;
            const entryAmount = newAmount * factor;

            if (rule.direction === 'CASH') {
              const cashEntry: CashLedger = {
                id: crypto.randomUUID(),
                transaction_id: transactionId,
                previous_cash: 0,
                amount: entryAmount,
                running_cash: 0,
                ledger_type: 'transaction',
                notes: tx.notes || `${service.name} transaction`,
                created_at: tx.created_at
              };
              await db.cash_ledger.add(cashEntry);
              await queueSync('cash_ledger', 'INSERT', cashEntry.id, cashEntry);
            } else {
              const mappedWalletId = rule.wallet_id || newWalletId;
              if (mappedWalletId) {
                // SBI redirection check
                const sbiWallet = await db.wallets.filter(w => w.name.toLowerCase().trim() === 'sbi').first();
                const sbiWalletId = sbiWallet?.id;

                let targetWalletIdForLedger = mappedWalletId;
                const selectedW = await db.wallets.get(mappedWalletId);
                if (selectedW && ['phonepe', 'google pay', 'gpay', 'navi'].includes(selectedW.name.toLowerCase().trim()) && sbiWalletId) {
                  targetWalletIdForLedger = sbiWalletId;
                }

                const walletEntry: WalletLedger = {
                  id: crypto.randomUUID(),
                  wallet_id: targetWalletIdForLedger,
                  transaction_id: transactionId,
                  previous_balance: 0,
                  amount: entryAmount,
                  running_balance: 0,
                  ledger_type: 'transaction',
                  notes: tx.notes || `${service.name} transaction`,
                  created_at: tx.created_at
                };
                await db.wallet_ledger.add(walletEntry);
                await queueSync('wallet_ledger', 'INSERT', walletEntry.id, walletEntry);
              }
            }
          }
        }
      } else {
        // Direct adjustment/load transaction
        const directionFactor = tx.direction === 'CREDIT' ? 1 : -1;
        const isCredit = tx.direction === 'CREDIT';

        if (newWalletId === null) {
          // Cash adjustment
          const cashEntry: CashLedger = {
            id: crypto.randomUUID(),
            transaction_id: transactionId,
            previous_cash: 0,
            amount: newAmount * directionFactor,
            running_cash: 0,
            ledger_type: 'adjustment',
            notes: tx.notes || (isCredit ? 'Cash Load' : 'Cash Deduct'),
            created_at: tx.created_at
          };
          await db.cash_ledger.add(cashEntry);
          await queueSync('cash_ledger', 'INSERT', cashEntry.id, cashEntry);
        } else {
          // Wallet adjustment
          let isJioOrAirtel = false;
          const w = await db.wallets.get(newWalletId);
          if (w) {
            const lowerName = w.name.toLowerCase();
            isJioOrAirtel = lowerName.includes('jio') || lowerName.includes('airtel') || lowerName.includes('lapu');
          }

          if (isJioOrAirtel && isCredit) {
            // Write 2 entries
            const entry1: WalletLedger = {
              id: crypto.randomUUID(),
              wallet_id: newWalletId,
              transaction_id: transactionId,
              previous_balance: 0,
              amount: newAmount,
              running_balance: 0,
              ledger_type: 'adjustment',
              notes: 'Wallet Load',
              created_at: tx.created_at
            };
            await db.wallet_ledger.add(entry1);
            await queueSync('wallet_ledger', 'INSERT', entry1.id, entry1);

            if (newCommission > 0) {
              const entry2: WalletLedger = {
                id: crypto.randomUUID(),
                wallet_id: newWalletId,
                transaction_id: transactionId,
                previous_balance: 0,
                amount: newCommission,
                running_balance: 0,
                ledger_type: 'adjustment',
                notes: 'Operator Commission',
                created_at: new Date(new Date(tx.created_at).getTime() + 1000).toISOString()
              };
              await db.wallet_ledger.add(entry2);
              await queueSync('wallet_ledger', 'INSERT', entry2.id, entry2);
            }
          } else {
            // Single entry
            const walletEntry: WalletLedger = {
              id: crypto.randomUUID(),
              wallet_id: newWalletId,
              transaction_id: transactionId,
              previous_balance: 0,
              amount: newAmount * directionFactor,
              running_balance: 0,
              ledger_type: 'adjustment',
              notes: tx.notes || (isCredit ? 'Wallet Load' : 'Wallet Deduct'),
              created_at: tx.created_at
            };
            await db.wallet_ledger.add(walletEntry);
            await queueSync('wallet_ledger', 'INSERT', walletEntry.id, walletEntry);
          }
        }
      }
    });

    // 3. Recalculate balances
    const sbiWallet = await db.wallets.filter(w => w.name.toLowerCase().trim() === 'sbi').first();
    const sbiWalletId = sbiWallet?.id;

    const walletsToRecalculate = new Set<string>();
    if (oldWalletId) walletsToRecalculate.add(oldWalletId);
    if (newWalletId) walletsToRecalculate.add(newWalletId);
    if (sbiWalletId) walletsToRecalculate.add(sbiWalletId);

    // SBI check
    for (const wId of Array.from(walletsToRecalculate)) {
      const wObj = await db.wallets.get(wId);
      if (wObj && ['phonepe', 'google pay', 'gpay', 'navi'].includes(wObj.name.toLowerCase().trim()) && sbiWalletId) {
        walletsToRecalculate.add(sbiWalletId);
      }
    }

    for (const wId of Array.from(walletsToRecalculate)) {
      await recalculateWalletBalances(wId);
    }
    await recalculateCashBalances();

    runSyncWorker();
  };

  // Adjust Balance (Create new ledger entry and transaction log)
  const adjustWalletBalance = async (
    walletId: string | 'CASH',
    action: 'add' | 'deduct',
    amount: number,
    commission: number
  ) => {
    triggerVibration();
    const nowStr = new Date().toISOString();
    const dateStr = getLocalYYYYMMDD();
    const transactionId = crypto.randomUUID();
    const txNumber = await generateNextTransactionNumber();

    // 1. Check if wallet is Jio or Airtel LAPU
    let isJioOrAirtel = false;
    if (walletId !== 'CASH') {
      const w = await db.wallets.get(walletId);
      if (w) {
        const lowerName = w.name.toLowerCase();
        isJioOrAirtel = lowerName.includes('jio') || lowerName.includes('airtel') || lowerName.includes('lapu');
      }
    }

    const direction = action === 'add' ? 'CREDIT' : 'DEBIT';
    const isCredit = action === 'add';

    // Transaction tracks the raw input amount and commission permanently
    const loadTx: Transaction = {
      id: transactionId,
      service_id: null,
      wallet_id: walletId === 'CASH' ? null : walletId,
      transfer_id: null,
      amount,
      direction,
      notes: isCredit ? 'Wallet Load' : 'Wallet Deduct',
      commission: isCredit ? commission : 0,
      transaction_number: txNumber,
      status: 'pending',
      synced: 0,
      created_local: 1,
      synced_at: null,
      is_deleted: 0,
      deleted_at: null,
      restored_at: null,
      transaction_date: dateStr,
      created_at: nowStr,
      updated_at: nowStr
    };

    await db.transaction('rw', [
      db.transactions,
      db.wallet_ledger,
      db.cash_ledger,
      db.sync_queue
    ], async () => {
      // Add transaction row
      await db.transactions.add(loadTx);
      await queueSync('transactions', 'INSERT', transactionId, loadTx);

      const factor = isCredit ? 1 : -1;

      if (walletId === 'CASH') {
        const latestCash = await db.cash_ledger.orderBy('created_at').last();
        const prevCash = latestCash?.running_cash || 0;

        const entry: CashLedger = {
          id: crypto.randomUUID(),
          transaction_id: transactionId,
          previous_cash: prevCash,
          amount: amount * factor,
          running_cash: prevCash + (amount * factor),
          ledger_type: 'adjustment',
          notes: isCredit ? 'Cash Load' : 'Cash Deduct',
          created_at: nowStr
        };
        await db.cash_ledger.add(entry);
        await queueSync('cash_ledger', 'INSERT', entry.id, entry);
      } else {
        if (isJioOrAirtel && isCredit) {
          // Jio/Airtel load gets TWO separate ledger entries:
          // Entry 1: Wallet Load (+Amount)
          const latestWallet1 = await db.wallet_ledger.where('wallet_id').equals(walletId).sortBy('created_at');
          const prevBal1 = latestWallet1.length > 0 ? latestWallet1[latestWallet1.length - 1].running_balance : 0;

          const entry1: WalletLedger = {
            id: crypto.randomUUID(),
            wallet_id: walletId,
            transaction_id: transactionId,
            previous_balance: prevBal1,
            amount: amount,
            running_balance: prevBal1 + amount,
            ledger_type: 'adjustment',
            notes: 'Wallet Load',
            created_at: nowStr
          };
          await db.wallet_ledger.add(entry1);
          await queueSync('wallet_ledger', 'INSERT', entry1.id, entry1);

          // Entry 2: Operator Commission (+Commission)
          if (commission > 0) {
            const entry2: WalletLedger = {
              id: crypto.randomUUID(),
              wallet_id: walletId,
              transaction_id: transactionId,
              previous_balance: prevBal1 + amount,
              amount: commission,
              running_balance: prevBal1 + amount + commission,
              ledger_type: 'adjustment',
              notes: 'Operator Commission',
              created_at: new Date(new Date(nowStr).getTime() + 1000).toISOString() // Shifted to maintain sorting order
            };
            await db.wallet_ledger.add(entry2);
            await queueSync('wallet_ledger', 'INSERT', entry2.id, entry2);
          }
        } else {
          // Regular wallet load/deduct gets a single entry
          const latestWallet = await db.wallet_ledger.where('wallet_id').equals(walletId).sortBy('created_at');
          const prevBal = latestWallet.length > 0 ? latestWallet[latestWallet.length - 1].running_balance : 0;

          const entry: WalletLedger = {
            id: crypto.randomUUID(),
            wallet_id: walletId,
            transaction_id: transactionId,
            previous_balance: prevBal,
            amount: amount * factor,
            running_balance: prevBal + (amount * factor),
            ledger_type: 'adjustment',
            notes: isCredit ? 'Wallet Load' : 'Wallet Deduct',
            created_at: nowStr
          };
          await db.wallet_ledger.add(entry);
          await queueSync('wallet_ledger', 'INSERT', entry.id, entry);
        }
      }
    });

    if (walletId === 'CASH') {
      await recalculateCashBalances();
    } else {
      await recalculateWalletBalances(walletId);
    }

    runSyncWorker();
  };

  // Atomic Wallet/Cash Transfer using dedicated wallet_transfers table
  const transferWallets = async (
    sourceWalletId: string | 'CASH',
    destWalletId: string | 'CASH',
    amount: number,
    notes: string
  ) => {
    if (amount <= 0) {
      throw new Error('Transfer amount must be greater than 0');
    }
    triggerVibration();
    const transferId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    const txNumber = await generateNextTransactionNumber();
    const nowStr = new Date().toISOString();
    const dateStr = getLocalYYYYMMDD();

    // Create structured Transfer record
    const newTransfer: WalletTransfer = {
      id: transferId,
      source_wallet_id: sourceWalletId === 'CASH' ? null : sourceWalletId,
      destination_wallet_id: destWalletId === 'CASH' ? null : destWalletId,
      amount,
      notes: notes || 'Self transfer',
      created_at: nowStr,
      updated_at: nowStr
    };

    // Create Main Transaction reference
    const sourceName = sourceWalletId === 'CASH' ? 'Cash' : wallets.find(w => w.id === sourceWalletId)?.name || 'Wallet';
    const destName = destWalletId === 'CASH' ? 'Cash' : wallets.find(w => w.id === destWalletId)?.name || 'Wallet';
    const txNotes = `Transfer from ${sourceName} to ${destName}. ${notes || ''}`.trim();

    const newTx: Transaction = {
      id: transactionId,
      service_id: null,
      wallet_id: sourceWalletId !== 'CASH' ? sourceWalletId : (destWalletId !== 'CASH' ? destWalletId : null),
      transfer_id: transferId,
      amount,
      direction: 'DEBIT',
      notes: txNotes,
      commission: 0,
      transaction_number: txNumber,
      status: 'pending',
      synced: 0,
      created_local: 1,
      synced_at: null,
      is_deleted: 0,
      deleted_at: null,
      restored_at: null,
      transaction_date: dateStr,
      created_at: nowStr,
      updated_at: nowStr
    };

    const sourceNotes = `Transfer Out - Ref: ${txNumber}. ${notes || ''}`.trim();
    const destNotes = `Transfer In - Ref: ${txNumber}. ${notes || ''}`.trim();

    await db.transaction('rw', [db.wallet_transfers, db.transactions, db.wallet_ledger, db.cash_ledger, db.sync_queue], async () => {
      // 1. Write structured transfer
      await db.wallet_transfers.add(newTransfer);
      await queueSync('wallet_transfers', 'INSERT', transferId, newTransfer);

      // 2. Write unified transaction
      await db.transactions.add(newTx);
      await queueSync('transactions', 'INSERT', transactionId, newTx);

      // 3. Write Debit Ledger Entry
      if (sourceWalletId === 'CASH') {
        const latestCash = await db.cash_ledger.orderBy('created_at').last();
        const prevCash = latestCash?.running_cash || 0;

        const sourceEntry: CashLedger = {
          id: crypto.randomUUID(),
          transaction_id: transactionId,
          previous_cash: prevCash,
          amount: -amount,
          running_cash: prevCash - amount,
          ledger_type: 'transfer',
          notes: sourceNotes,
          created_at: nowStr
        };
        await db.cash_ledger.add(sourceEntry);
        await queueSync('cash_ledger', 'INSERT', sourceEntry.id, sourceEntry);
      } else {
        const latestW = await db.wallet_ledger.where('wallet_id').equals(sourceWalletId).sortBy('created_at');
        const prevW = latestW.length > 0 ? latestW[latestW.length - 1].running_balance : 0;

        const sourceEntry: WalletLedger = {
          id: crypto.randomUUID(),
          wallet_id: sourceWalletId,
          transaction_id: transactionId,
          previous_balance: prevW,
          amount: -amount,
          running_balance: prevW - amount,
          ledger_type: 'transfer',
          notes: sourceNotes,
          created_at: nowStr
        };
        await db.wallet_ledger.add(sourceEntry);
        await queueSync('wallet_ledger', 'INSERT', sourceEntry.id, sourceEntry);
      }

      // BUG 4 FIX: Capture dest balance BEFORE writing dest entry to avoid race condition.
      // Previously the code read from db AFTER source entry was written, which could pick up
      // the source debit in a same-timestamp scenario.
      let destPrevCash = 0;
      let destPrevWBal = 0;
      if (destWalletId === 'CASH') {
        const latestDestCash = await db.cash_ledger.orderBy('created_at').last();
        destPrevCash = latestDestCash?.running_cash || 0;
      } else {
        const latestDestW = await db.wallet_ledger.where('wallet_id').equals(destWalletId).sortBy('created_at');
        destPrevWBal = latestDestW.length > 0 ? latestDestW[latestDestW.length - 1].running_balance : 0;
      }

      // 4. Write Credit Ledger Entry
      if (destWalletId === 'CASH') {
        const destEntry: CashLedger = {
          id: crypto.randomUUID(),
          transaction_id: transactionId,
          previous_cash: destPrevCash,
          amount: amount,
          running_cash: destPrevCash + amount,
          ledger_type: 'transfer',
          notes: destNotes,
          created_at: nowStr
        };
        await db.cash_ledger.add(destEntry);
        await queueSync('cash_ledger', 'INSERT', destEntry.id, destEntry);
      } else {
        const destEntry: WalletLedger = {
          id: crypto.randomUUID(),
          wallet_id: destWalletId,
          transaction_id: transactionId,
          previous_balance: destPrevWBal,
          amount: amount,
          running_balance: destPrevWBal + amount,
          ledger_type: 'transfer',
          notes: destNotes,
          created_at: nowStr
        };
        await db.wallet_ledger.add(destEntry);
        await queueSync('wallet_ledger', 'INSERT', destEntry.id, destEntry);
      }
    });

    // Run sequential balance recalculations
    if (sourceWalletId === 'CASH' || destWalletId === 'CASH') {
      await recalculateCashBalances();
    }
    if (sourceWalletId !== 'CASH') {
      await recalculateWalletBalances(sourceWalletId);
    }
    if (destWalletId !== 'CASH') {
      await recalculateWalletBalances(destWalletId);
    }

    runSyncWorker();
  };

  // Update Setting (Shop configs, etc.)
  const updateSetting = async (key: string, value: unknown) => {
    const nowStr = new Date().toISOString();
    const existing = rawSettings.find(s => s.key === key);
    const updatedSetting: Setting = {
      key,
      value,
      created_at: existing?.created_at || nowStr,
      updated_at: nowStr
    };

    await db.transaction('rw', [db.settings, db.sync_queue], async () => {
      await db.settings.put(updatedSetting);
      await queueSync('settings', 'UPDATE', key, updatedSetting);
    });

    runSyncWorker();
  };

  // Wallet CRUD
  const addWallet = async (
    name: string,
    provider: Wallet['provider'],
    icon: string | null,
    color: string | null
  ): Promise<string> => {
    if (!name.trim()) throw new Error('Wallet name cannot be empty');
    triggerVibration();
    const id = crypto.randomUUID();
    const nowStr = new Date().toISOString();
    const count = await db.wallets.count();

    const newWallet: Wallet = {
      id,
      name: name.trim(),
      provider,
      icon,
      color,
      is_active: 1,
      sort_order: count,
      created_at: nowStr,
      updated_at: nowStr
    };

    await db.transaction('rw', [db.wallets, db.sync_queue], async () => {
      await db.wallets.add(newWallet);
      await queueSync('wallets', 'INSERT', id, newWallet);
    });

    runSyncWorker();
    return id;
  };

  const editWallet = async (
    id: string,
    name: string,
    provider: Wallet['provider'],
    icon: string | null,
    color: string | null,
    sortOrder: number,
    isActive: boolean
  ) => {
    if (!name.trim()) throw new Error('Wallet name cannot be empty');
    const w = await db.wallets.get(id);
    if (!w) return;

    const nowStr = new Date().toISOString();
    const updatedWallet: Wallet = {
      ...w,
      name: name.trim(),
      provider,
      icon,
      color,
      sort_order: sortOrder,
      is_active: isActive ? 1 : 0,
      updated_at: nowStr
    };

    await db.transaction('rw', [db.wallets, db.sync_queue], async () => {
      await db.wallets.update(id, {
        name: name.trim(),
        provider,
        icon,
        color,
        sort_order: sortOrder,
        is_active: isActive ? 1 : 0,
        updated_at: nowStr
      });
      await queueSync('wallets', 'UPDATE', id, updatedWallet);
    });

    // If wallet is toggled or updated, trigger recalculations
    await recalculateWalletBalances(id);

    runSyncWorker();
  };

  const deleteWallet = async (id: string) => {
    triggerVibration();
    await db.transaction('rw', [db.wallets, db.sync_queue], async () => {
      await db.wallets.delete(id);
      await queueSync('wallets', 'DELETE', id, null);
    });

    runSyncWorker();
  };

  const reorderWallets = async (walletIds: string[]) => {
    const nowStr = new Date().toISOString();
    await db.transaction('rw', [db.wallets, db.sync_queue], async () => {
      for (let i = 0; i < walletIds.length; i++) {
        const id = walletIds[i];
        const w = await db.wallets.get(id);
        if (w) {
          const updated = { ...w, sort_order: i, updated_at: nowStr };
          await db.wallets.update(id, { sort_order: i, updated_at: nowStr });
          await queueSync('wallets', 'UPDATE', id, updated);
        }
      }
    });

    runSyncWorker();
  };

  // Reorder / Configure service properties
  const updateServiceConfig = async (
    id: string,
    name: string,
    color: string,
    is_active: boolean,
    sort_order: number,
    quick_amounts: number[],
    requires_wallet_selection: boolean
  ) => {
    if (!name.trim()) throw new Error('Service name cannot be empty');
    const s = await db.services.get(id);
    if (!s) return;

    const nowStr = new Date().toISOString();
    const updated: Service = {
      ...s,
      name: name.trim(),
      color,
      is_active: is_active ? 1 : 0,
      sort_order,
      quick_amounts,
      requires_wallet_selection: requires_wallet_selection ? 1 : 0,
      updated_at: nowStr
    };

    await db.transaction('rw', [db.services, db.sync_queue], async () => {
      await db.services.update(id, {
        name: name.trim(),
        color,
        is_active: is_active ? 1 : 0,
        sort_order,
        quick_amounts,
        requires_wallet_selection: requires_wallet_selection ? 1 : 0,
        updated_at: nowStr
      });
      await queueSync('services', 'UPDATE', id, updated);
    });

    runSyncWorker();
  };

  // Complete first-time configuration with smart defaults
  const finishSetup = async (openingCash: number, initialWallets: { name: string; balance: number }[]) => {
    const nowStr = new Date().toISOString();

    await db.transaction('rw', [
      db.settings,
      db.wallets,
      db.wallet_ledger,
      db.cash_ledger,
      db.services,
      db.service_wallet_rules,
      db.sync_queue
    ], async () => {
      // 1. Set settings flag
      const completeSetting = { key: 'setup_completed', value: true, created_at: nowStr, updated_at: nowStr };
      await db.settings.put(completeSetting);
      await queueSync('settings', 'UPDATE', 'setup_completed', completeSetting);

      // 2. Set cash opening balance
      const cashEntry: CashLedger = {
        id: crypto.randomUUID(),
        transaction_id: null,
        previous_cash: 0,
        amount: openingCash,
        running_cash: openingCash,
        ledger_type: 'opening',
        notes: 'Initial Cash Opening Balance',
        created_at: nowStr
      };
      await db.cash_ledger.add(cashEntry);
      await queueSync('cash_ledger', 'INSERT', cashEntry.id, cashEntry);

      // 3. Create wallets and write their opening ledger entries
      const createdWalletMap: Record<string, string> = {}; // Name -> UUID

      const finalWalletsToCreate = [...initialWallets];
      const systemWalletsToSeed = [
        { name: 'Fino(S)', balance: 0 },
        { name: 'Fino(N)', balance: 0 },
        { name: 'SBI', balance: 0 },
        { name: 'PhonePe', balance: 0 },
        { name: 'Google Pay', balance: 0 },
        { name: 'Navi', balance: 0 }
      ];
      for (const sysW of systemWalletsToSeed) {
        if (!finalWalletsToCreate.some(w => w.name.toLowerCase().trim() === sysW.name.toLowerCase().trim())) {
          finalWalletsToCreate.push(sysW);
        }
      }

      for (let i = 0; i < finalWalletsToCreate.length; i++) {
        const wallet = finalWalletsToCreate[i];
        const walletId = crypto.randomUUID();
        createdWalletMap[wallet.name] = walletId;

        // Smart defaults for provider, icon, and color
        let provider: Wallet['provider'] = 'Other';
        let icon = 'wallet';
        let color = '#475569';

        const lowerName = wallet.name.toLowerCase();
        if (lowerName.includes('fino')) {
          provider = 'FINO';
          icon = 'fino';
          color = '#e21226';
        } else if (lowerName.includes('jio')) {
          provider = 'Other';
          icon = 'jio';
          color = '#0f3cc9';
        } else if (lowerName.includes('airtel') || lowerName.includes('lapu')) {
          provider = 'Other';
          icon = 'airtel';
          color = '#e21226';
        } else if (lowerName.includes('vi ')) {
          provider = 'Other';
          icon = 'vi';
          color = '#eb0029';
        } else if (lowerName.includes('phonepe')) {
          provider = 'PhonePe';
          icon = 'phonepe';
          color = '#5f259f';
        } else if (lowerName.includes('google') || lowerName.includes('gpay')) {
          provider = 'Google Pay';
          icon = 'google-pay';
          color = '#1a73e8';
        } else if (lowerName.includes('spice')) {
          provider = 'Spice Money';
          icon = 'spice-money';
          color = '#ff6600';
        } else if (lowerName.includes('navi')) {
          provider = 'Other';
          icon = 'landmark';
          color = '#0d9488';
        }

        const newWallet: Wallet = {
          id: walletId,
          name: wallet.name,
          provider,
          icon,
          color,
          is_active: 1,
          sort_order: i,
          created_at: nowStr,
          updated_at: nowStr
        };
        await db.wallets.add(newWallet);
        await queueSync('wallets', 'INSERT', walletId, newWallet);

        if (wallet.balance > 0) {
          const wlEntry: WalletLedger = {
            id: crypto.randomUUID(),
            wallet_id: walletId,
            transaction_id: null,
            previous_balance: 0,
            amount: wallet.balance,
            running_balance: wallet.balance,
            ledger_type: 'opening',
            notes: `Initial ${wallet.name} Opening Balance`,
            created_at: nowStr
          };
          await db.wallet_ledger.add(wlEntry);
          await queueSync('wallet_ledger', 'INSERT', wlEntry.id, wlEntry);
        }
      }

      // 4. Map relational service rules based on newly created wallets
      const allServices = await db.services.toArray();
      // BUG 2 FIX: Look up Fino(S) as primary key name (was looking for old 'Fino Wallet')
      const finoWalletId = createdWalletMap['Fino(S)'] || createdWalletMap['Fino Wallet'] || createdWalletMap['Fino'];

      for (const svc of allServices) {
        // If Recharge, require wallet selection — user picks wallet at transaction time
        if (svc.type.includes('recharge')) {
          // BUG 3 FIX: wallet_id must be null so user selection is respected.
          // Previously static wallet_id was overriding requires_wallet_selection=1.
          const rule: ServiceWalletRule = {
            id: crypto.randomUUID(),
            service_id: svc.id,
            wallet_id: null, // User selects at transaction time (requires_wallet_selection = 1)
            action: 'DEBIT',
            direction: 'WALLET',
            priority: 0,
            created_at: nowStr
          };
          await db.service_wallet_rules.add(rule);
          await queueSync('service_wallet_rules', 'INSERT', rule.id, rule);
        }

        // AEPS: Credit Fino, Debit Cash
        if (svc.type === 'aeps_withdrawal') {
          if (finoWalletId) {
            const r1: ServiceWalletRule = {
              id: crypto.randomUUID(),
              service_id: svc.id,
              wallet_id: finoWalletId,
              action: 'CREDIT',
              direction: 'WALLET',
              priority: 0,
              created_at: nowStr
            };
            await db.service_wallet_rules.add(r1);
            await queueSync('service_wallet_rules', 'INSERT', r1.id, r1);
          }
          const r2: ServiceWalletRule = {
            id: crypto.randomUUID(),
            service_id: svc.id,
            wallet_id: null,
            action: 'DEBIT',
            direction: 'CASH',
            priority: 1,
            created_at: nowStr
          };
          await db.service_wallet_rules.add(r2);
          await queueSync('service_wallet_rules', 'INSERT', r2.id, r2);
        }

        // Money Transfer: Credit Cash, Debit Fino
        if (svc.type === 'money_transfer') {
          const r1: ServiceWalletRule = {
            id: crypto.randomUUID(),
            service_id: svc.id,
            wallet_id: null,
            action: 'CREDIT',
            direction: 'CASH',
            priority: 0,
            created_at: nowStr
          };
          await db.service_wallet_rules.add(r1);
          await queueSync('service_wallet_rules', 'INSERT', r1.id, r1);

          if (finoWalletId) {
            const r2: ServiceWalletRule = {
              id: crypto.randomUUID(),
              service_id: svc.id,
              wallet_id: finoWalletId,
              action: 'DEBIT',
              direction: 'WALLET',
              priority: 1,
              created_at: nowStr
            };
            await db.service_wallet_rules.add(r2);
            await queueSync('service_wallet_rules', 'INSERT', r2.id, r2);
          }
        }

        // Electricity Bill & Loan: Debit selected wallet (rule is DEBIT WALLET, wallet_id is NULL)
        if (svc.type === 'electricity_bill' || svc.type === 'loan_repayment') {
          const rule: ServiceWalletRule = {
            id: crypto.randomUUID(),
            service_id: svc.id,
            wallet_id: null, // Select dynamically on transaction screen
            action: 'DEBIT',
            direction: 'WALLET',
            priority: 0,
            created_at: nowStr
          };
          await db.service_wallet_rules.add(rule);
          await queueSync('service_wallet_rules', 'INSERT', rule.id, rule);
        }
      }
    });

    runSyncWorker();
  };

  const wipeAllData = async () => {
    // 1. Wipe remote tables on Supabase if online
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('wallet_transfers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('wallet_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('cash_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('wallets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('service_wallet_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('settings').delete().in('key', ['setup_completed', 'shop_name', 'shop_logo']);
      } catch (err) {
        console.error('Failed to clear Supabase database:', err);
      }
    }

    // 2. Clear local IndexedDB tables
    await db.transactions.clear();
    await db.wallet_transfers.clear();
    await db.wallet_ledger.clear();
    await db.cash_ledger.clear();
    await db.wallets.clear();
    await db.service_wallet_rules.clear();
    await db.sync_queue.clear();

    // Reset settings in Dexie and state
    await db.settings.delete('setup_completed');
    await db.settings.delete('shop_name');
    await db.settings.delete('shop_logo');
  };

  return (
    <DatabaseContext.Provider
      value={{
        isOnline,
        syncStatus,
        wallets: (() => {
          const seen = new Set<string>();
          return allWalletsForAdmin
            .filter(w => w.is_active === 1)
            .filter(w => {
              const nameLower = w.name.toLowerCase().trim();
              if (seen.has(nameLower)) return false;
              seen.add(nameLower);
              return true;
            });
        })(),
        services: (() => {
          const seen = new Set<string>();
          return allServicesForAdmin
            .filter(s => s.is_active === 1)
            .filter(s => {
              const nameLower = s.name.toLowerCase().trim();
              if (seen.has(nameLower)) return false;
              seen.add(nameLower);
              return true;
            });
        })(),
        transactions,
        cashBalance,
        walletBalances,
        settings,
        lastSyncError,
        isLoaded: isLoaded &&
                  walletsRaw !== undefined &&
                  allWalletsForAdminRaw !== undefined &&
                  servicesRaw !== undefined &&
                  allServicesForAdminRaw !== undefined &&
                  transactionsRaw !== undefined &&
                  rawSettingsRaw !== undefined &&
                  walletLedgerRaw !== undefined &&
                  cashLedgerRaw !== undefined,
        saveTransaction,
        deleteTransaction,
        restoreTransaction,
        adjustWalletBalance,
        transferWallets,
        updateSetting,
        getSuggestedCommission,
        editTransaction,
        addWallet,
        editWallet,
        deleteWallet,
        reorderWallets,
        updateServiceConfig,
        finishSetup,
        pullLatest,
        runSyncWorker,
        wipeAllData
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
