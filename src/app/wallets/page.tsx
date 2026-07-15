'use client';

import React, { useState } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomNav } from '@/components/layout/BottomNav';
import { ArrowLeft, ArrowDownUp, History, ClipboardEdit, PlusCircle, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard } from 'lucide-react';

// Wallet Logo / Icon mapper in lists
const WalletIcon = ({ name, icon, color }: { name: string; icon?: string | null; color?: string | null }) => {
  const cleanIcon = icon?.toLowerCase() || '';
  const cleanName = name.toLowerCase();
  
  const bgCol = 'rgba(255, 255, 255, 0.8)'; // White container background
  const textCol = color || '#475569';
  
  if (cleanIcon === 'cash' || cleanName.includes('cash')) {
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: bgCol, color: textCol }}>
        <svg className="w-5 h-5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect width="20" height="12" x="2" y="6" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      </div>
    );
  }
  if (cleanIcon === 'fino' || cleanName.includes('fino')) {
    return (
      <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm flex items-center justify-center bg-white p-1">
        <img src="/fino-logo.svg" alt="Fino" className="w-full h-full object-contain" />
      </div>
    );
  }
  if (cleanIcon === 'sbi' || cleanName.includes('sbi')) {
    return (
      <div className="w-9 h-9 rounded-full bg-[#0054a6] flex items-center justify-center shadow-sm border border-white">
        <span className="text-white font-black text-[11px] leading-none">SBI</span>
      </div>
    );
  }
  if (cleanIcon === 'jio' || cleanName.includes('jio')) {
    return (
      <div className="w-9 h-9 rounded-full overflow-hidden shadow-sm border border-white bg-white">
        <img src="/jio-logo.svg" alt="Jio" className="w-full h-full object-contain" />
      </div>
    );
  }
  if (cleanIcon === 'airtel' || cleanName.includes('airtel') || cleanName.includes('lapu')) {
    return (
      <div className="w-9 h-9 rounded-full overflow-hidden shadow-sm border border-white bg-white">
        <img src="/airtel-logo.svg" alt="Airtel" className="w-full h-full object-contain" />
      </div>
    );
  }
  if (cleanIcon === 'phonepe' || cleanName.includes('phonepe')) {
    return (
      <div className="w-9 h-9 rounded-full bg-[#5f259f] flex items-center justify-center shadow-sm border border-white">
        <span className="text-white font-black text-[10px] leading-none">PP</span>
      </div>
    );
  }
  if (cleanIcon === 'google-pay' || cleanIcon === 'gpay' || cleanName.includes('google') || cleanName.includes('gpay')) {
    return (
      <div className="w-9 h-9 rounded-full bg-[#1a73e8] flex items-center justify-center shadow-sm border border-white">
        <span className="text-white font-black text-xs leading-none">G</span>
      </div>
    );
  }
  if (cleanIcon === 'spice-money' || cleanName.includes('spice')) {
    return (
      <div className="w-9 h-9 rounded-full bg-[#ff6600] flex items-center justify-center shadow-sm border border-white">
        <span className="text-white font-black text-[10px] leading-none">SP</span>
      </div>
    );
  }
  
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: bgCol, color: textCol }}>
      <CreditCard className="w-5 h-5" />
    </div>
  );
};

export default function WalletsPage() {
  const router = useRouter();
  const {
    isLoaded,
    wallets,
    cashBalance,
    walletBalances,
    adjustWalletBalance,
    transferWallets
  } = useDatabase();

  // Active Tab: 'list' or 'transfer'
  const [activeTab, setActiveTab] = useState<'list' | 'transfer'>('list');

  // Adjustment Modal States
  const [adjustTarget, setAdjustTarget] = useState<{ id: string | 'CASH'; name: string; balance: number } | null>(null);
  const [adjustMode, setAdjustMode] = useState<'add' | 'deduct'>('add');
  const [amountVal, setAmountVal] = useState<string>('');
  const [commissionVal, setCommissionVal] = useState<string>('0');
  const [adjustError, setAdjustError] = useState<string>('');
  const [adjustSuccess, setAdjustSuccess] = useState<boolean>(false);
  const [adjusting, setAdjusting] = useState<boolean>(false);

  // Transfer Form States
  const [sourceId, setSourceId] = useState<string>('');
  const [destId, setDestId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferError, setTransferError] = useState<string>('');
  const [transferSuccess, setTransferSuccess] = useState<boolean>(false);
  const [transferring, setTransferring] = useState<boolean>(false);

  const getBalance = (id: string | 'CASH') => {
    return id === 'CASH' ? cashBalance : (walletBalances[id] || 0);
  };

  const handleOpenAdjust = (id: string | 'CASH', name: string) => {
    const bal = getBalance(id);
    setAdjustTarget({ id, name, balance: bal });
    setAmountVal('');
    setCommissionVal('0');
    setAdjustMode('add');
    setAdjustError('');
    setAdjustSuccess(false);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;

    const parsedAmount = parseFloat(amountVal);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAdjustError('Please enter a valid amount greater than 0.');
      return;
    }

    const parsedCommission = parseFloat(commissionVal) || 0;
    if (parsedCommission < 0) {
      setAdjustError('Commission cannot be negative.');
      return;
    }

    const isJioOrAirtel = adjustTarget.id !== 'CASH' && (() => {
      const lowerName = adjustTarget.name.toLowerCase();
      return lowerName.includes('jio') || lowerName.includes('airtel') || lowerName.includes('lapu');
    })();

    const addDelta = (isJioOrAirtel && adjustMode === 'add') ? (parsedAmount + parsedCommission) : parsedAmount;
    const delta = adjustMode === 'add' ? addDelta : -parsedAmount;
    const targetBalance = adjustTarget.balance + delta;
    if (targetBalance < 0) {
      setAdjustError('Wallet balance cannot become negative.');
      return;
    }

    setAdjusting(true);
    setAdjustError('');

    try {
      await adjustWalletBalance(adjustTarget.id, adjustMode, parsedAmount, parsedCommission);
      setAdjustSuccess(true);
      setTimeout(() => {
        setAdjustTarget(null);
      }, 1000);
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Failed to adjust balance.');
    } finally {
      setAdjusting(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');
    setTransferSuccess(false);

    if (!sourceId || !destId) {
      setTransferError('Please select both source and destination accounts.');
      return;
    }

    if (sourceId === destId) {
      setTransferError('Source and destination accounts must be different.');
      return;
    }

    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('Please enter a valid transfer amount.');
      return;
    }

    const sourceBal = getBalance(sourceId);
    if (amt > sourceBal) {
      setTransferError(`Sufficient funds not available. Available balance: ₹${sourceBal.toLocaleString('en-IN')}`);
      return;
    }

    setTransferring(true);

    try {
      await transferWallets(sourceId, destId, amt, transferNotes || 'Self transfer');
      setTransferSuccess(true);
      setTransferAmount('');
      setTransferNotes('');
      // Switch back to list after success delay
      setTimeout(() => {
        setTransferSuccess(false);
        setActiveTab('list');
      }, 1200);
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Transfer failed.');
    } finally {
      setTransferring(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col justify-between bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 bg-white sticky top-0 z-10">
        <button
          onClick={() => router.push('/')}
          className="p-2 text-slate-600 hover:text-slate-900 active:scale-95 transition-all rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5px]" />
        </button>
        <span className="text-base font-extrabold text-slate-800">Accounts & Wallets</span>
        <div className="w-9 h-9"></div> {/* Balancer spacer */}
      </div>

      {/* Main Tab Wrapper */}
      <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto pb-24">
        <Tabs value={activeTab} onValueChange={(val: string) => setActiveTab(val as 'list' | 'transfer')} className="w-full">
          <TabsList className="grid grid-cols-2 h-11 bg-slate-100/80 p-1 rounded-xl mb-4">
            <TabsTrigger value="list" className="rounded-lg font-bold text-xs">
              Accounts
            </TabsTrigger>
            <TabsTrigger value="transfer" className="rounded-lg font-bold text-xs flex items-center gap-1.5">
              <ArrowDownUp className="w-3.5 h-3.5" />
              Transfer Funds
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: WALLET LIST */}
          <TabsContent value="list" className="space-y-4 outline-none">
            {/* Cash Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-3xl p-5 shadow-md shadow-emerald-100 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider block">Physical Balance</span>
                <h3 className="text-sm font-extrabold mt-1">Cash in Shop</h3>
                <span className="text-2xl font-black block mt-2">
                  ₹{cashBalance.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleOpenAdjust('CASH', 'Cash in Shop')}
                  className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <ClipboardEdit className="w-3.5 h-3.5" />
                  Add / Adjust
                </button>
                <Link
                  href="/ledger?walletId=CASH"
                  className="px-3.5 py-1.5 bg-emerald-700/35 hover:bg-emerald-700/50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <History className="w-3.5 h-3.5" />
                  History
                </Link>
              </div>
            </div>

            {/* Wallets List */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-1">Wallets</h4>
              
              {(() => {
                const displayWallets = wallets.filter(w => !['phonepe', 'google pay', 'gpay', 'navi'].includes(w.name.toLowerCase().trim()));
                if (displayWallets.length === 0) {
                  return (
                    <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-[20px] text-center text-slate-400 text-sm font-semibold">
                      No wallets set up yet. Go to Settings to add wallets.
                    </div>
                  );
                }
                return displayWallets.map((wallet) => {
                  const bal = walletBalances[wallet.id] || 0;
                  return (
                    <div
                      key={wallet.id}
                      className="bg-white border border-slate-100 rounded-[20px] p-4 flex justify-between items-center shadow-sm hover:bg-slate-50/20 transition-all"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <WalletIcon name={wallet.name} icon={wallet.icon} color={wallet.color} />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Wallet Account</span>
                          <h4 className="text-base font-extrabold text-slate-800 mt-1 truncate">{wallet.name}</h4>
                          <span className="text-lg font-black text-slate-800 block mt-2">
                            ₹{bal.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1.5 ml-4">
                        <button
                          onClick={() => handleOpenAdjust(wallet.id, wallet.name)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                        >
                          <ClipboardEdit className="w-3.5 h-3.5" />
                          Add / Adjust
                        </button>
                        <Link
                          href={`/ledger?walletId=${wallet.id}`}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 border border-slate-100"
                        >
                          <History className="w-3.5 h-3.5" />
                          History
                        </Link>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </TabsContent>

          {/* Tab 2: TRANSFER FUNDS */}
          <TabsContent value="transfer" className="outline-none">
            <form onSubmit={handleTransferSubmit} className="space-y-4 p-4 bg-slate-50/50 border border-slate-100 rounded-[24px]">
              {transferError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold border border-red-100">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{transferError}</span>
                </div>
              )}

              {/* Source Select */}
              <div className="space-y-1.5">
                <Label htmlFor="source" className="text-slate-700 font-extrabold text-xs">Source Account (Debit)</Label>
                <select
                  id="source"
                  className="w-full h-11 px-3 border border-slate-200 text-slate-800 font-semibold text-sm rounded-xl bg-white appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '14px'
                  }}
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  disabled={transferring || transferSuccess}
                >
                  <option value="">Select source</option>
                  <option value="CASH">Cash in Shop (₹{cashBalance.toLocaleString('en-IN')})</option>
                  {wallets.filter(w => !['phonepe', 'google pay', 'gpay', 'navi'].includes(w.name.toLowerCase().trim())).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} (₹{(walletBalances[w.id] || 0).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Select */}
              <div className="space-y-1.5">
                <Label htmlFor="dest" className="text-slate-700 font-extrabold text-xs">Destination Account (Credit)</Label>
                <select
                  id="dest"
                  className="w-full h-11 px-3 border border-slate-200 text-slate-800 font-semibold text-sm rounded-xl bg-white appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '14px'
                  }}
                  value={destId}
                  onChange={(e) => setDestId(e.target.value)}
                  disabled={transferring || transferSuccess}
                >
                  <option value="">Select destination</option>
                  <option value="CASH">Cash in Shop (₹{cashBalance.toLocaleString('en-IN')})</option>
                  {wallets.filter(w => !['phonepe', 'google pay', 'gpay', 'navi'].includes(w.name.toLowerCase().trim())).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} (₹{(walletBalances[w.id] || 0).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-slate-700 font-extrabold text-xs">Transfer Amount (₹)</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400">₹</span>
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-7.5 h-11 border-slate-200 focus-visible:ring-blue-600 text-sm font-bold rounded-xl bg-white"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    disabled={transferring || transferSuccess}
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-slate-700 font-extrabold text-xs">Notes / Reason (Optional)</Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="e.g., Shifted funds, Added Balance"
                  className="h-11 border-slate-200 focus-visible:ring-blue-600 text-sm font-semibold rounded-xl bg-white"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  disabled={transferring || transferSuccess}
                />
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {['Added Balance', 'Shifted Funds', 'Wallet Correction'].map((quickNote) => (
                    <button
                      key={quickNote}
                      type="button"
                      onClick={() => setTransferNotes(quickNote)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-md text-[9px] font-bold border border-slate-150 active:scale-95 transition-all"
                    >
                      {quickNote}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Transfer */}
              <Button
                type="submit"
                disabled={transferring || transferSuccess}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl active:scale-[0.98] transition-all mt-2"
              >
                {transferring ? 'Processing transfer...' : 'Initiate Atomic Transfer'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>

      {/* Balance Adjustment Dialog Modal */}
      <Dialog open={adjustTarget !== null} onOpenChange={(open) => !open && setAdjustTarget(null)}>
        <DialogContent className="max-w-xs sm:max-w-sm rounded-[24px] p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-900">
              Add / Deduct Wallet Amount
            </DialogTitle>
            <p className="text-xs text-slate-500 font-medium">
              Update balance for {adjustTarget?.name} by adding or deducting funds.
            </p>
          </DialogHeader>

          {adjustTarget && (
            <form onSubmit={handleAdjustSubmit} className="space-y-4 my-3">
              {adjustError && (
                <div className="flex items-center gap-1.5 p-2 bg-red-50 text-red-600 rounded-lg text-[11px] font-semibold border border-red-100">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{adjustError}</span>
                </div>
              {/* Add/Deduct Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAdjustMode('add')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    adjustMode === 'add'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-650 hover:bg-slate-200/50'
                  }`}
                >
                  + Add
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('deduct')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    adjustMode === 'deduct'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-650 hover:bg-slate-200/50'
                  }`}
                >
                  - Deduct
                </button>
              </div>

              {/* Live Preview & Current Balance */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                  <span>Current Balance:</span>
                  <span className="font-extrabold text-slate-800">
                    ₹{adjustTarget.balance.toLocaleString('en-IN')}
                  </span>
                </div>
                
                {amountVal && !isNaN(parseFloat(amountVal)) && (
                  <>
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                      <span>{adjustMode === 'add' ? 'Added Amount:' : 'Deducted Amount:'}</span>
                      <span className={adjustMode === 'add' ? 'font-extrabold text-emerald-600' : 'font-extrabold text-red-600'}>
                        {adjustMode === 'add' ? '+' : '-'} ₹{parseFloat(amountVal).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {adjustMode === 'add' && commissionVal && !isNaN(parseFloat(commissionVal)) && parseFloat(commissionVal) > 0 && (
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                        <span>Commission:</span>
                        <span className="font-extrabold text-emerald-600">
                          + ₹{parseFloat(commissionVal).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center text-xs font-bold text-slate-800">
                      <span>New Target Balance:</span>
                      <span className="font-black text-blue-600 text-sm">
                        ₹{(
                          adjustTarget.balance + 
                          (adjustMode === 'add' 
                            ? (parseFloat(amountVal) + (
                                (adjustTarget.id !== 'CASH' && (adjustTarget.name.toLowerCase().includes('jio') || adjustTarget.name.toLowerCase().includes('airtel') || adjustTarget.name.toLowerCase().includes('lapu')))
                                ? (parseFloat(commissionVal) || 0)
                                : 0
                              ))
                            : -parseFloat(amountVal))
                        ).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="adj-amount" className="text-slate-700 font-bold text-xs">Amount (₹)</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-bold text-slate-400">₹</span>
                  <Input
                    id="adj-amount"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-7 h-10 border-slate-200 focus-visible:ring-blue-600 text-sm font-bold rounded-lg"
                    value={amountVal}
                    onChange={(e) => setAmountVal(e.target.value)}
                    disabled={adjusting || adjustSuccess}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {adjustMode === 'add' && (
                <div className="space-y-1">
                  <Label htmlFor="adj-commission" className="text-slate-700 font-bold text-xs">Commission (₹)</Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-bold text-slate-400">₹</span>
                    <Input
                      id="adj-commission"
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="pl-7 h-10 border-slate-200 focus-visible:ring-blue-600 text-sm font-bold rounded-lg"
                      value={commissionVal}
                      onChange={(e) => setCommissionVal(e.target.value)}
                      disabled={adjusting || adjustSuccess}
                      required
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={adjusting || adjustSuccess}
                  className="flex-1 h-10 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700"
                >
                  {adjusting ? 'Saving...' : 'Save Load'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAdjustTarget(null)}
                  disabled={adjusting || adjustSuccess}
                  className="flex-1 h-10 bg-slate-200 text-slate-800 font-bold text-xs rounded-lg hover:bg-slate-350"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}

          {adjustSuccess && (
            <div className="absolute inset-0 bg-white/95 rounded-[24px] flex flex-col items-center justify-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 stroke-[2.5]" />
              <span className="text-sm font-extrabold text-slate-800">Adjustment Saved</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Snackbar Overlay for transfers */}
      {transferSuccess && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex items-center justify-center px-6">
          <div className="flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-full shadow-xl border border-slate-800 animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
            <span className="text-sm font-bold">Transfer Completed Successfully</span>
          </div>
        </div>
      )}

      {/* Navigation Layout */}
      <BottomNav />
    </div>
  );
}
