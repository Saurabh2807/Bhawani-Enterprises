'use client';

import React, { useState, useEffect, use } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, History, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TransactionPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const router = useRouter();
  const { services, wallets, saveTransaction, isLoaded, getSuggestedCommission } = useDatabase();

  // Resolve params using React.use()
  const { serviceId } = use(params);

  // Form states
  const [amount, setAmount] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [commission, setCommission] = useState<string>('0');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const service = services.find((s) => s.id === serviceId);

  // Auto-fill suggested commission when amount changes
  useEffect(() => {
    if (service) {
      const parsedAmount = parseFloat(amount);
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        const suggested = getSuggestedCommission(service.type, parsedAmount);
        setCommission(suggested.toString());
      } else {
        setCommission('0');
      }
    }
  }, [amount, service, getSuggestedCommission]);

  // Set smart default wallet based on service type
  useEffect(() => {
    if (service && wallets.length > 0) {
      const type = service.type;
      let matchedWallet = null;

      if (type === 'jio_recharge') {
        matchedWallet = wallets.find((w) => w.name.toLowerCase().includes('jio'));
      } else if (type === 'airtel_recharge') {
        matchedWallet = wallets.find((w) => w.name.toLowerCase().includes('airtel') || w.name.toLowerCase().includes('lapu'));
      } else if (type === 'vi_recharge') {
        // BUG 6 FIX: Use word boundary match \bvi\b to avoid matching 'navi', 'service' etc.
        matchedWallet = wallets.find((w) => /\bvi\b/i.test(w.name));
      } else if (type === 'bsnl_recharge') {
        matchedWallet = wallets.find((w) => w.name.toLowerCase().includes('bsnl'));
      } else if (type === 'aeps_withdrawal' || type === 'money_transfer' || type === 'balance_enquiry') {
        matchedWallet = wallets.find((w) => w.name.toLowerCase().includes('fino'));
      }

      // Fallback to first wallet if no match is found
      if (matchedWallet) {
        const selectedId = matchedWallet.id;
        const timer = setTimeout(() => setSelectedWalletId(selectedId), 0);
        return () => clearTimeout(timer);
      } else if (wallets.length > 0) {
        const selectedId = wallets[0].id;
        const timer = setTimeout(() => setSelectedWalletId(selectedId), 0);
        return () => clearTimeout(timer);
      }
    }
  }, [service, wallets]);

  if (!isLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500">Loading service details...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-lg font-bold text-slate-900 mt-4">Service Not Found</h2>
        <Link href="/" className="mt-4 text-blue-600 font-bold underline">
          Go back to Home
        </Link>
      </div>
    );
  }

  const handleQuickAmountClick = (val: number) => {
    setAmount(val.toString());
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    
    // Balance enquiry does not require amount
    const isEnquiry = service.type === 'balance_enquiry';
    
    if (!isEnquiry && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      setError('Please enter a valid amount.');
      return;
    }

    if (!selectedWalletId && (service.requires_wallet_selection || isEnquiry)) {
      setError('Please select a wallet.');
      return;
    }

    setSaving(true);

    try {
      // Balance Enquiry has 0 amount
      const txAmount = isEnquiry ? 0 : parsedAmount;
      const commissionVal = parseFloat(commission) || 0;
      await saveTransaction(service.id, txAmount, selectedWalletId || null, commissionVal);
      
      setSuccess(true);
      // Auto-redirect to home screen after 1.2 seconds (very fast UX)
      setTimeout(() => {
        router.replace('/');
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction.');
      setSaving(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col justify-between bg-white min-h-screen">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 bg-white sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 text-slate-600 hover:text-slate-900 active:scale-95 transition-all rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5px]" />
        </button>
        <span className="text-base font-extrabold text-slate-800">{service.name}</span>
        
        {/* Top-Right History Button */}
        <Link
          href={`/ledger?serviceId=${service.id}`}
          className="p-2 text-blue-600 hover:text-blue-800 active:scale-95 transition-all rounded-lg flex items-center gap-1 text-sm font-bold"
        >
          <History className="w-5 h-5 stroke-[2.5px]" />
          <span>History</span>
        </Link>
      </div>

      {/* Main Form content */}
      <form onSubmit={handleSave} className="flex-grow p-6 flex flex-col justify-between gap-6 pb-20">
        <div className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 font-semibold">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Wallet Selector — show when service requires wallet selection */}
          {service.requires_wallet_selection === 1 ? (
            <div className="space-y-2">
              <Label htmlFor="wallet" className="text-slate-700 font-extrabold text-sm">
                Select Wallet
              </Label>
              <select
                id="wallet"
                className="w-full h-12 px-4 border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-800 font-semibold text-base rounded-[16px] bg-slate-50/50 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 16px center',
                  backgroundSize: '16px'
                }}
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                disabled={saving || success}
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Amount Field (Hidden for balance enquiry) */}
          {service.type !== 'balance_enquiry' && (
            <div className="space-y-3">
              <Label htmlFor="amount" className="text-slate-700 font-extrabold text-sm">
                Amount (₹)
              </Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-xl font-black text-slate-400">₹</span>
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  placeholder="0.00"
                  className="pl-9 h-14 border-slate-200 focus-visible:ring-blue-600 text-xl font-black rounded-[18px] bg-slate-50/20"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={saving || success}
                  required
                  autoFocus
                />
              </div>

              {/* Quick Amount Chips */}
              {service.quick_amounts && service.quick_amounts.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Quick Amount</span>
                  <div className="grid grid-cols-4 gap-2">
                    {service.quick_amounts.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickAmountClick(amt)}
                        className={`h-9 border rounded-xl font-bold text-xs transition-all active:scale-95 ${
                          amount === amt.toString()
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Commission Field */}
          <div className="space-y-3">
            <Label htmlFor="commission" className="text-slate-700 font-extrabold text-sm">
              Commission (₹)
            </Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-xl font-black text-slate-400">₹</span>
              <Input
                id="commission"
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                className="pl-9 h-14 border-slate-200 focus-visible:ring-blue-600 text-xl font-black rounded-[18px] bg-slate-50/20"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                disabled={saving || success}
                required
              />
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <Button
          type="submit"
          disabled={saving || success}
          className="w-full h-14 text-white font-bold text-base shadow-md shadow-blue-100 rounded-[18px] active:scale-[0.98] transition-all"
          style={{ backgroundColor: service.color || '#1d4ed8' }}
        >
          {saving ? (
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Saving Transaction...</span>
            </div>
          ) : service.type === 'balance_enquiry' ? (
            'Check Balance'
          ) : (
            'Save Transaction'
          )}
        </Button>
      </form>

      {/* Success Snackbar Overlay (Fast & Simple) */}
      {success && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex items-center justify-center px-6">
          <div className="flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-full shadow-xl border border-slate-800 animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
            <span className="text-sm font-bold">Transaction Saved</span>
          </div>
        </div>
      )}
    </div>
  );
}
