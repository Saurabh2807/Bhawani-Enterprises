'use client';

import React, { useState } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Wallet, DollarSign, ArrowRight } from 'lucide-react';

export const SetupWizard = () => {
  const { finishSetup } = useDatabase();
  const [cash, setCash] = useState<string>('');
  const [wallets, setWallets] = useState<{ name: string; balance: string }[]>([
    { name: 'Fino(S)', balance: '' },
    { name: 'Fino(N)', balance: '' },
    { name: 'Jio Wallet', balance: '' },
    { name: 'Airtel LAPU', balance: '' },
    { name: 'SBI', balance: '' }
  ]);
  const [customWalletName, setCustomWalletName] = useState<string>('');
  const [customWalletBalance, setCustomWalletBalance] = useState<string>('');
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleAddCustomWallet = () => {
    if (!customWalletName.trim()) {
      setError('Please enter a wallet name.');
      return;
    }
    const nameExists = wallets.some(
      (w) => w.name.toLowerCase() === customWalletName.trim().toLowerCase()
    );
    if (nameExists) {
      setError('A wallet with this name already exists.');
      return;
    }

    setWallets([
      ...wallets,
      { name: customWalletName.trim(), balance: customWalletBalance || '0' }
    ]);
    setCustomWalletName('');
    setCustomWalletBalance('');
    setShowAddCustom(false);
    setError('');
  };

  const handleRemoveWallet = (index: number) => {
    setWallets(wallets.filter((_, i) => i !== index));
  };

  const handleWalletBalanceChange = (index: number, val: string) => {
    const updated = [...wallets];
    updated[index].balance = val;
    setWallets(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const parsedCash = parseFloat(cash) || 0;
      if (parsedCash < 0) {
        setError('Cash balance cannot be negative.');
        setSubmitting(false);
        return;
      }

      const formattedWallets = wallets.map((w) => {
        const bal = parseFloat(w.balance) || 0;
        if (bal < 0) {
          throw new Error(`Balance for ${w.name} cannot be negative.`);
        }
        return { name: w.name, balance: bal };
      });

      await finishSetup(parsedCash, formattedWallets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup. Please check inputs.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-8 min-h-screen">
      {/* Top Heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">First Time Setup</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">
          Set up opening balances to start your digital register.
        </p>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="flex-grow flex flex-col gap-6 overflow-y-auto max-h-[70vh] pr-1">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 font-semibold">
            {error}
          </div>
        )}

        {/* Cash in Shop */}
        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-2">
          <Label htmlFor="cash" className="text-blue-900 font-bold text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600 stroke-[2.5px]" />
            Cash in Shop
          </Label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-lg font-bold text-slate-400">₹</span>
            <Input
              id="cash"
              type="number"
              inputMode="decimal"
              pattern="[0-9]*"
              placeholder="0.00"
              className="pl-9 h-12 bg-white border-blue-200/60 focus-visible:ring-blue-600 text-lg font-bold rounded-xl"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
        </div>

        {/* Wallet Section */}
        <div className="space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600 stroke-[2.5px]" />
            Wallet Balances
          </h2>

          <div className="space-y-3">
            {wallets.map((wallet, index) => (
              <div
                key={wallet.name}
                className="flex items-center gap-3 p-3 bg-slate-50/60 border border-slate-100 rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <Label className="text-slate-800 font-bold text-sm block truncate">{wallet.name}</Label>
                </div>
                <div className="w-32 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-bold text-slate-400">₹</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    placeholder="0"
                    className="pl-7 h-10 bg-white border-slate-200 focus-visible:ring-blue-600 text-sm font-semibold rounded-lg text-right pr-3"
                    value={wallet.balance}
                    onChange={(e) => handleWalletBalanceChange(index, e.target.value)}
                    disabled={submitting}
                  />
                </div>
                {/* Prevent deleting Fino Wallet since it is core for AEPS/Money Transfer mapping */}
                {wallet.name !== 'Fino Wallet' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveWallet(index)}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 active:scale-95 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Wallet Section Toggle */}
          {!showAddCustom ? (
            <button
              type="button"
              onClick={() => setShowAddCustom(true)}
              className="w-full h-11 border border-dashed border-blue-200 text-blue-600 hover:bg-blue-50/30 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <Plus className="w-4 h-4 stroke-[2.5px]" />
              Add Wallet
            </button>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-500 tracking-wider uppercase">Add Custom Wallet</h3>
              <div className="space-y-2">
                <Label htmlFor="custom-name" className="text-slate-700 font-bold text-xs">Wallet Name</Label>
                <Input
                  id="custom-name"
                  type="text"
                  placeholder="e.g., Paytm Wallet"
                  className="h-10 bg-white border-slate-250 focus-visible:ring-blue-600 text-sm font-semibold rounded-lg"
                  value={customWalletName}
                  onChange={(e) => setCustomWalletName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-balance" className="text-slate-700 font-bold text-xs">Opening Balance (₹)</Label>
                <Input
                  id="custom-balance"
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  className="h-10 bg-white border-slate-250 focus-visible:ring-blue-600 text-sm font-semibold rounded-lg"
                  value={customWalletBalance}
                  onChange={(e) => setCustomWalletBalance(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleAddCustomWallet}
                  className="flex-1 h-9 bg-blue-600 text-white font-bold text-xs rounded-lg"
                >
                  Confirm
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowAddCustom(false);
                    setError('');
                  }}
                  className="flex-1 h-9 bg-slate-200 hover:bg-slate-350 text-slate-800 font-bold text-xs rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Submit Button */}
      <div className="mt-6">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || showAddCustom}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-md shadow-blue-100 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {submitting ? 'Finishing setup...' : 'Finish Setup'}
          <ArrowRight className="w-5 h-5 stroke-[2.5px]" />
        </Button>
      </div>
    </div>
  );
};
