'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { db, type Wallet, type Service, type ServiceWalletRule, type Transaction, type WalletLedger, type CashLedger, type Setting, type SyncItem } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useLiveQuery } from 'dexie-react-hooks';

interface DatabaseContextType {
  isOnline: boolean;
  syncStatus: 'synced' | 'pending' | 'local_only';
  wallets: Wallet[];
  services: Service[];
  transactions: Transaction[];
  cashBalance: number;
  walletBalances: Record<string, number>;
  settings: Record<string, any>;
  isLoaded: boolean;
  
  // Actions
  saveTransaction: (serviceId: string, amount: number, walletId: string | null, notes: string | null) => Promise<Transaction>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  restoreTransaction: (transactionId: string) => Promise<void>;
  adjustWalletBalance: (walletId: string | 'CASH', newBalance: number, reason: string) => Promise<void>;
  transferWallets: (sourceWalletId: string | 'CASH', destWalletId: string | 'CASH', amount: number, notes: string) => Promise<void>;
  updateSetting: (key: string, value: any) => Promise<void>;
  
  // Wallet CRUD
  addWallet: (name: string) => Promise<string>;
  editWallet: (id: string, name: string, sortOrder: number, isActive: boolean) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;
  reorderWallets: (walletIds: string[]) => Promise<void>;

  // Service CRUD / settings
  updateServiceConfig: (id: string, name: string, color: string, is_active: boolean, sort_order: number, quick_amounts: number[], requires_wallet_selection: boolean) => Promise<void>;

  // Setup
  finishSetup: (openingCash: number, walletBalances: { name: string; balance: number }[]) => Promise<void>;
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
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'local_only'>('local_only');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Monitor online status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
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
  
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSyncStatus('local_only');
    } else if (queueLength > 0) {
      setSyncStatus('pending');
    } else {
      setSyncStatus('synced');
    }
  }, [queueLength]);

  // Live queries for tables
  const wallets = useLiveQuery(async () => {
    const list = await db.wallets.where('is_active').equals(1).toArray();
    return list.sort((a, b) => a.sort_order - b.sort_order);
  }) || [];
  const allWalletsForAdmin = useLiveQuery(() => db.wallets.orderBy('sort_order').toArray()) || [];
  const services = useLiveQuery(async () => {
    const list = await db.services.where('is_active').equals(1).toArray();
    return list.sort((a, b) => a.sort_order - b.sort_order);
  }) || [];
  const allServicesForAdmin = useLiveQuery(() => db.services.orderBy('sort_order').toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('created_at').reverse().toArray()) || [];
  const rawSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const walletLedger = useLiveQuery(() => db.wallet_ledger.toArray()) || [];
  const cashLedger = useLiveQuery(() => db.cash_ledger.toArray()) || [];

  // Convert rawSettings array to key-value record
  const settings = React.useMemo(() => {
    return rawSettings.reduce<Record<string, any>>((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  }, [rawSettings]);

  // Calculate balances autoritatively: Opening + Ledgers where transaction is NOT soft-deleted
  const { cashBalance, walletBalances } = React.useMemo(() => {
    // 1. Create a Set of transaction IDs that are NOT soft-deleted
    const activeTxIds = new Set<string>();
    transactions.forEach(tx => {
      if (tx.deleted_at === null) {
        activeTxIds.add(tx.id);
      }
    });

    // 2. Sum Cash Ledger
    let cash = 0;
    cashLedger.forEach(entry => {
      // If linked to transaction, only add if transaction is active (not deleted)
      if (entry.transaction_id === null || activeTxIds.has(entry.transaction_id)) {
        cash += entry.amount;
      }
    });

    // 3. Sum Wallet Ledger grouped by Wallet
    const wBalances: Record<string, number> = {};
    // Seed with zero for all known wallets
    allWalletsForAdmin.forEach(w => {
      wBalances[w.id] = 0;
    });

    walletLedger.forEach(entry => {
      if (entry.transaction_id === null || activeTxIds.has(entry.transaction_id)) {
        wBalances[entry.wallet_id] = (wBalances[entry.wallet_id] || 0) + entry.amount;
      }
    });

    return {
      cashBalance: cash,
      walletBalances: wBalances
    };
  }, [transactions, cashLedger, walletLedger, allWalletsForAdmin]);

  // Safe device vibration
  const triggerVibration = () => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  // Generate sequential transaction number
  const generateNextTransactionNumber = async (): Promise<string> => {
    const txs = await db.transactions.toArray();
    let maxNum = 0;
    txs.forEach(tx => {
      const match = tx.transaction_number.match(/^TX(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    return `TX${nextNum.toString().padStart(6, '0')}`;
  };

  // Push task to sync queue
  const queueSync = async (table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', key: string, data: any) => {
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
          const syncData = { ...item.data };
          // Convert boolean numbers to true boolean for PG database compatibility
          if ('is_active' in syncData) syncData.is_active = syncData.is_active === 1;
          if ('requires_wallet_selection' in syncData) syncData.requires_wallet_selection = syncData.requires_wallet_selection === 1;
          if ('synced' in syncData) syncData.synced = true; // Mark synced on remote

          const { error } = await supabase.from(item.table).upsert(syncData);
          if (!error) {
            success = true;
          } else {
            console.error(`Sync insert/update failed for ${item.table} (${item.key}):`, error);
          }
        } else if (item.action === 'DELETE') {
          const { error } = await supabase.from(item.table).delete().eq(pkCol, item.key);
          if (!error) {
            success = true;
          } else {
            console.error(`Sync delete failed for ${item.table} (${item.key}):`, error);
          }
        }

        if (success) {
          await db.sync_queue.delete(item.id!);
          
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
      console.error('Error in sync worker:', err);
    }
  }, [isOnline]);

  // Pull latest updates from Supabase
  const pullLatest = useCallback(async () => {
    if (!isOnline || !isSupabaseConfigured() || !supabase) return;

    try {
      // Check if queue has pending syncs first, do not pull to prevent conflicts
      const count = await db.sync_queue.count();
      if (count > 0) return;

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

      // 5. Pull transactions
      const { data: txData } = await supabase.from('transactions').select('*');
      if (txData) {
        for (const item of txData) {
          await db.transactions.put({
            id: item.id,
            service_id: item.service_id,
            wallet_id: item.wallet_id,
            amount: parseFloat(item.amount),
            notes: item.notes,
            transaction_number: item.transaction_number,
            status: 'synced',
            synced: 1,
            created_local: item.created_local ? 1 : 0,
            synced_at: item.synced_at,
            deleted_at: item.deleted_at,
            created_at: item.created_at,
            updated_at: item.updated_at
          });
        }
      }

      // 6. Pull wallet ledger
      const { data: wlData } = await supabase.from('wallet_ledger').select('*');
      if (wlData) {
        for (const item of wlData) {
          await db.wallet_ledger.put({
            id: item.id,
            wallet_id: item.wallet_id,
            transaction_id: item.transaction_id,
            amount: parseFloat(item.amount),
            ledger_type: item.ledger_type,
            notes: item.notes,
            created_at: item.created_at
          });
        }
      }

      // 7. Pull cash ledger
      const { data: clData } = await supabase.from('cash_ledger').select('*');
      if (clData) {
        for (const item of clData) {
          await db.cash_ledger.put({
            id: item.id,
            transaction_id: item.transaction_id,
            amount: parseFloat(item.amount),
            ledger_type: item.ledger_type,
            notes: item.notes,
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
      if (servicesCount === 0) {
        // Seed services
        const defaultServices: Service[] = [
          { id: crypto.randomUUID(), name: 'Jio Recharge', type: 'jio_recharge', color: '#0f3cc9', is_active: 1, sort_order: 1, quick_amounts: [149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: crypto.randomUUID(), name: 'Airtel Recharge', type: 'airtel_recharge', color: '#e21226', is_active: 1, sort_order: 2, quick_amounts: [149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: crypto.randomUUID(), name: 'VI Recharge', type: 'vi_recharge', color: '#eb0029', is_active: 1, sort_order: 3, quick_amounts: [149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: crypto.randomUUID(), name: 'BSNL Recharge', type: 'bsnl_recharge', color: '#0f68b3', is_active: 1, sort_order: 4, quick_amounts: [149, 199, 239, 249, 299, 349, 399, 449, 599, 719, 799, 999], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: crypto.randomUUID(), name: 'AEPS Cash Withdrawal', type: 'aeps_withdrawal', color: '#10b981', is_active: 1, sort_order: 5, quick_amounts: [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000], requires_wallet_selection: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: crypto.randomUUID(), name: 'Money Transfer', type: 'money_transfer', color: '#3b82f6', is_active: 1, sort_order: 6, quick_amounts: [], requires_wallet_selection: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: crypto.randomUUID(), name: 'Electricity Bill Payment', type: 'electricity_bill', color: '#0d9488', is_active: 1, sort_order: 7, quick_amounts: [], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: crypto.randomUUID(), name: 'Balance Enquiry', type: 'balance_enquiry', color: '#f97316', is_active: 1, sort_order: 8, quick_amounts: [], requires_wallet_selection: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: crypto.randomUUID(), name: 'Loan Repayment', type: 'loan_repayment', color: '#8b5cf6', is_active: 1, sort_order: 9, quick_amounts: [], requires_wallet_selection: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
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

  // Save Transaction Function
  const saveTransaction = async (
    serviceId: string,
    amount: number,
    walletId: string | null,
    notes: string | null
  ): Promise<Transaction> => {
    triggerVibration();

    const transactionId = crypto.randomUUID();
    const txNumber = await generateNextTransactionNumber();
    const nowStr = new Date().toISOString();

    const service = await db.services.get(serviceId);
    if (!service) throw new Error(`Service ${serviceId} not found`);

    const newTx: Transaction = {
      id: transactionId,
      service_id: serviceId,
      wallet_id: walletId,
      amount,
      notes,
      transaction_number: txNumber,
      status: 'pending',
      synced: 0,
      created_local: 1,
      synced_at: null,
      deleted_at: null,
      created_at: nowStr,
      updated_at: nowStr
    };

    // Database transactional write
    await db.transaction('rw', [db.transactions, db.wallet_ledger, db.cash_ledger, db.sync_queue], async () => {
      await db.transactions.add(newTx);
      await queueSync('transactions', 'INSERT', transactionId, newTx);

      // Fetch rules for this service
      const rules = await db.service_wallet_rules
        .where('service_id')
        .equals(serviceId)
        .sortBy('priority');

      for (const rule of rules) {
        // Calculate factor based on DEBIT or CREDIT
        const factor = rule.action === 'DEBIT' ? -1 : 1;
        const entryAmount = amount * factor;

        if (rule.direction === 'CASH') {
          const cashEntry: CashLedger = {
            id: crypto.randomUUID(),
            transaction_id: transactionId,
            amount: entryAmount,
            ledger_type: 'transaction',
            notes: notes || `${service.name} transaction`,
            created_at: nowStr
          };
          await db.cash_ledger.add(cashEntry);
          await queueSync('cash_ledger', 'INSERT', cashEntry.id, cashEntry);
        } else {
          // Mapped wallet id from rule or dynamically selected wallet
          const mappedWalletId = rule.wallet_id || walletId;
          if (mappedWalletId) {
            const walletEntry: WalletLedger = {
              id: crypto.randomUUID(),
              wallet_id: mappedWalletId,
              transaction_id: transactionId,
              amount: entryAmount,
              ledger_type: 'transaction',
              notes: notes || `${service.name} transaction`,
              created_at: nowStr
            };
            await db.wallet_ledger.add(walletEntry);
            await queueSync('wallet_ledger', 'INSERT', walletEntry.id, walletEntry);
          }
        }
      }
    });

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

    const updatedTx = { ...tx, deleted_at: nowStr, updated_at: nowStr };

    await db.transaction('rw', [db.transactions, db.sync_queue], async () => {
      await db.transactions.update(transactionId, { deleted_at: nowStr, updated_at: nowStr });
      await queueSync('transactions', 'UPDATE', transactionId, updatedTx);
    });

    runSyncWorker();
  };

  // Restore Transaction
  const restoreTransaction = async (transactionId: string) => {
    triggerVibration();
    const nowStr = new Date().toISOString();
    const tx = await db.transactions.get(transactionId);
    if (!tx) return;

    const updatedTx = { ...tx, deleted_at: null, updated_at: nowStr };

    await db.transaction('rw', [db.transactions, db.sync_queue], async () => {
      await db.transactions.update(transactionId, { deleted_at: null, updated_at: nowStr });
      await queueSync('transactions', 'UPDATE', transactionId, updatedTx);
    });

    runSyncWorker();
  };

  // Adjust Balance (Create new ledger entry)
  const adjustWalletBalance = async (walletId: string | 'CASH', newBalance: number, reason: string) => {
    triggerVibration();
    const nowStr = new Date().toISOString();

    const currentBal = walletId === 'CASH' ? cashBalance : (walletBalances[walletId] || 0);
    const diff = newBalance - currentBal;

    if (diff === 0) return; // No adjustment needed

    if (walletId === 'CASH') {
      const entry: CashLedger = {
        id: crypto.randomUUID(),
        transaction_id: null,
        amount: diff,
        ledger_type: 'adjustment',
        notes: reason || 'Opening Balance Adjustment',
        created_at: nowStr
      };
      await db.transaction('rw', [db.cash_ledger, db.sync_queue], async () => {
        await db.cash_ledger.add(entry);
        await queueSync('cash_ledger', 'INSERT', entry.id, entry);
      });
    } else {
      const entry: WalletLedger = {
        id: crypto.randomUUID(),
        wallet_id: walletId,
        transaction_id: null,
        amount: diff,
        ledger_type: 'adjustment',
        notes: reason || 'Opening Balance Adjustment',
        created_at: nowStr
      };
      await db.transaction('rw', [db.wallet_ledger, db.sync_queue], async () => {
        await db.wallet_ledger.add(entry);
        await queueSync('wallet_ledger', 'INSERT', entry.id, entry);
      });
    }

    runSyncWorker();
  };

  // Atomic Wallet/Cash Transfer
  const transferWallets = async (
    sourceWalletId: string | 'CASH',
    destWalletId: string | 'CASH',
    amount: number,
    notes: string
  ) => {
    triggerVibration();
    const transactionId = crypto.randomUUID();
    const txNumber = await generateNextTransactionNumber();
    const nowStr = new Date().toISOString();

    const newTx: Transaction = {
      id: transactionId,
      service_id: null, // System transaction
      wallet_id: sourceWalletId !== 'CASH' ? sourceWalletId : (destWalletId !== 'CASH' ? destWalletId : null),
      amount,
      notes: `Transfer from ${sourceWalletId === 'CASH' ? 'Cash' : 'Wallet'} to ${destWalletId === 'CASH' ? 'Cash' : 'Wallet'}. ${notes}`,
      transaction_number: txNumber,
      status: 'pending',
      synced: 0,
      created_local: 1,
      synced_at: null,
      deleted_at: null,
      created_at: nowStr,
      updated_at: nowStr
    };

    const sourceNotes = `Transfer Out - Ref: ${txNumber}. ${notes}`;
    const destNotes = `Transfer In - Ref: ${txNumber}. ${notes}`;

    await db.transaction('rw', [db.transactions, db.wallet_ledger, db.cash_ledger, db.sync_queue], async () => {
      // Write Transaction record
      await db.transactions.add(newTx);
      await queueSync('transactions', 'INSERT', transactionId, newTx);

      // Debit Source
      if (sourceWalletId === 'CASH') {
        const sourceEntry: CashLedger = {
          id: crypto.randomUUID(),
          transaction_id: transactionId,
          amount: -amount,
          ledger_type: 'transfer',
          notes: sourceNotes,
          created_at: nowStr
        };
        await db.cash_ledger.add(sourceEntry);
        await queueSync('cash_ledger', 'INSERT', sourceEntry.id, sourceEntry);
      } else {
        const sourceEntry: WalletLedger = {
          id: crypto.randomUUID(),
          wallet_id: sourceWalletId,
          transaction_id: transactionId,
          amount: -amount,
          ledger_type: 'transfer',
          notes: sourceNotes,
          created_at: nowStr
        };
        await db.wallet_ledger.add(sourceEntry);
        await queueSync('wallet_ledger', 'INSERT', sourceEntry.id, sourceEntry);
      }

      // Credit Destination
      if (destWalletId === 'CASH') {
        const destEntry: CashLedger = {
          id: crypto.randomUUID(),
          transaction_id: transactionId,
          amount: amount,
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
          amount: amount,
          ledger_type: 'transfer',
          notes: destNotes,
          created_at: nowStr
        };
        await db.wallet_ledger.add(destEntry);
        await queueSync('wallet_ledger', 'INSERT', destEntry.id, destEntry);
      }
    });

    runSyncWorker();
  };

  // Update Setting (Shop configs, etc.)
  const updateSetting = async (key: string, value: any) => {
    const nowStr = new Date().toISOString();
    const updatedSetting: Setting = {
      key,
      value,
      created_at: settings[key]?.created_at || nowStr,
      updated_at: nowStr
    };

    await db.transaction('rw', [db.settings, db.sync_queue], async () => {
      await db.settings.put(updatedSetting);
      await queueSync('settings', 'UPDATE', key, updatedSetting);
    });

    runSyncWorker();
  };

  // Wallet CRUD
  const addWallet = async (name: string): Promise<string> => {
    triggerVibration();
    const id = crypto.randomUUID();
    const nowStr = new Date().toISOString();
    const count = await db.wallets.count();

    const newWallet: Wallet = {
      id,
      name,
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

  const editWallet = async (id: string, name: string, sortOrder: number, isActive: boolean) => {
    const w = await db.wallets.get(id);
    if (!w) return;

    const nowStr = new Date().toISOString();
    const updatedWallet: Wallet = {
      ...w,
      name,
      sort_order: sortOrder,
      is_active: isActive ? 1 : 0,
      updated_at: nowStr
    };

    await db.transaction('rw', [db.wallets, db.sync_queue], async () => {
      await db.wallets.update(id, { name, sort_order: sortOrder, is_active: isActive ? 1 : 0, updated_at: nowStr });
      await queueSync('wallets', 'UPDATE', id, updatedWallet);
    });

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
    const s = await db.services.get(id);
    if (!s) return;

    const nowStr = new Date().toISOString();
    const updated: Service = {
      ...s,
      name,
      color,
      is_active: is_active ? 1 : 0,
      sort_order,
      quick_amounts,
      requires_wallet_selection: requires_wallet_selection ? 1 : 0,
      updated_at: nowStr
    };

    await db.transaction('rw', [db.services, db.sync_queue], async () => {
      await db.services.update(id, {
        name,
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

  // Complete first-time configuration
  const finishSetup = async (openingCash: number, initialWallets: { name: string; balance: number }[]) => {
    const nowStr = new Date().toISOString();

    await db.transaction('rw', [
      db.settings,
      db.wallets,
      db.wallet_ledger,
      db.cash_ledger,
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
        amount: openingCash,
        ledger_type: 'opening',
        notes: 'Initial Cash Opening Balance',
        created_at: nowStr
      };
      await db.cash_ledger.add(cashEntry);
      await queueSync('cash_ledger', 'INSERT', cashEntry.id, cashEntry);

      // 3. Create wallets and write their opening ledger entries
      const createdWalletMap: Record<string, string> = {}; // Name -> UUID

      for (let i = 0; i < initialWallets.length; i++) {
        const wallet = initialWallets[i];
        const walletId = crypto.randomUUID();
        createdWalletMap[wallet.name] = walletId;

        const newWallet: Wallet = {
          id: walletId,
          name: wallet.name,
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
            amount: wallet.balance,
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
      const finoWalletId = createdWalletMap['Fino Wallet'] || createdWalletMap['Fino'];

      for (const svc of allServices) {
        // If Recharge, require wallet selection (rule is DEBIT WALLET, but wallet_id is NULL)
        if (svc.type.includes('recharge')) {
          const rule: ServiceWalletRule = {
            id: crypto.randomUUID(),
            service_id: svc.id,
            wallet_id: createdWalletMap[svc.name.replace(' Recharge', ' Wallet')] || createdWalletMap[svc.name.replace(' Recharge', ' LAPU')] || null,
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

  return (
    <DatabaseContext.Provider
      value={{
        isOnline,
        syncStatus,
        wallets: allWalletsForAdmin.filter(w => w.is_active === 1),
        services: allServicesForAdmin.filter(s => s.is_active === 1),
        transactions,
        cashBalance,
        walletBalances,
        settings,
        isLoaded,
        saveTransaction,
        deleteTransaction,
        restoreTransaction,
        adjustWalletBalance,
        transferWallets,
        updateSetting,
        addWallet,
        editWallet,
        deleteWallet,
        reorderWallets,
        updateServiceConfig,
        finishSetup
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
