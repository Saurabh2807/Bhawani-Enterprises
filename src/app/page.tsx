'use client';

import React, { useState, useEffect } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { useAuth } from '@/context/AuthContext';
import { SetupWizard } from '@/components/setup/SetupWizard';
import { BottomNav } from '@/components/layout/BottomNav';
import Link from 'next/link';
import { Eye, EyeOff, Smartphone, Zap, Search, CreditCard, Landmark, RefreshCw } from 'lucide-react';

// Service Logo / Icon Mapper for Fintech feel
const ServiceLogo = ({ type }: { type: string; color?: string }) => {
  switch (type) {
    case 'jio_recharge':
      return (
        <img src="/jio-logo.svg" alt="Jio" className="w-12 h-12 rounded-full object-contain shadow-sm bg-white" />
      );
    case 'airtel_recharge':
      return (
        <img src="/airtel-logo.svg" alt="Airtel" className="w-12 h-12 rounded-full object-contain p-1 shadow-sm bg-white" />
      );
    case 'vi_recharge':
      return (
        <img src="/vi-logo.svg" alt="VI" className="w-12 h-12 rounded-full object-contain p-1 shadow-sm bg-[#eb0029]" />
      );
    case 'bsnl_recharge':
      return (
        <img src="/bsnl-logo.svg" alt="BSNL" className="w-12 h-12 rounded-full object-contain p-1 shadow-sm bg-white" />
      );
    case 'aeps_withdrawal':
      return (
        <img src="/aeps-logo.svg" alt="AEPS" className="w-12 h-12 rounded-full object-contain p-1.5 shadow-sm bg-white" />
      );
    case 'money_transfer':
      return (
        <div className="w-12 h-12 rounded-full bg-[#3b82f6] flex items-center justify-center text-white shadow-sm">
          <svg className="w-6 h-6 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 16 4 4 4-4" />
            <path d="M7 20V4" />
            <path d="m21 8-4-4-4 4" />
            <path d="M17 4v16" />
          </svg>
        </div>
      );
    case 'electricity_bill':
      return (
        <div className="w-12 h-12 rounded-full bg-[#0d9488] flex items-center justify-center text-white shadow-sm">
          <Zap className="w-6 h-6 fill-current stroke-[2.5]" />
        </div>
      );
    case 'balance_enquiry':
      return (
        <div className="w-12 h-12 rounded-full bg-[#f97316] flex items-center justify-center text-white shadow-sm">
          <Search className="w-6 h-6 stroke-[2.5]" />
        </div>
      );
    case 'loan_repayment':
      return (
        <div className="w-12 h-12 rounded-full bg-[#8b5cf6] flex items-center justify-center text-white shadow-sm">
          <Landmark className="w-6 h-6 stroke-[2.5]" />
        </div>
      );
    default:
      return (
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <Smartphone className="w-6 h-6" />
        </div>
      );
  }
};

// Wallet Logo / Icon mapper in lists
const WalletIcon = ({ name, icon, color }: { name: string; icon?: string | null; color?: string | null }) => {
  const cleanIcon = icon?.toLowerCase() || '';
  const cleanName = name.toLowerCase();
  
  const bgCol = 'rgba(255, 255, 255, 0.8)'; // White container background for star/bill
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

export default function HomePage() {
  const { isLoaded, settings, services, wallets, cashBalance, walletBalances, syncStatus, pullLatest, transactions } = useDatabase();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [manualSyncing, setManualSyncing] = useState<boolean>(false);
  const [hideBalances, setHideBalances] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bhawani_hide_balances') === 'true';
    }
    return false;
  });

  const todayProfit = React.useMemo(() => {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    return transactions
      .filter(tx => tx.is_deleted === 0 && tx.transaction_date === todayStr)
      .reduce((sum, tx) => sum + (tx.commission || 0), 0);
  }, [transactions]);

  const monthlyProfit = React.useMemo(() => {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${y}-${m}`;

    return transactions
      .filter(tx => tx.is_deleted === 0 && tx.transaction_date && tx.transaction_date.startsWith(monthPrefix))
      .reduce((sum, tx) => sum + (tx.commission || 0), 0);
  }, [transactions]);

  // Set time client side to avoid Next.js server/client hydration mismatch
  useEffect(() => {
    const initTimer = setTimeout(() => {
      setCurrentTime(new Date());
    }, 0);
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(timer);
    };
  }, []);

  const toggleHideBalances = () => {
    const nextVal = !hideBalances;
    setHideBalances(nextVal);
    localStorage.setItem('bhawani_hide_balances', String(nextVal));
  };

  const formatBalance = (amount: number) => {
    if (hideBalances) return '₹ ••••';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (!isLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500">Loading Database...</p>
      </div>
    );
  }

  // If first-time configuration is not completed, launch SetupWizard
  if (settings.setup_completed !== true) {
    return <SetupWizard />;
  }

  const handleManualSyncClick = async () => {
    if (manualSyncing || syncStatus === 'pending') return;
    setManualSyncing(true);
    try {
      await pullLatest();
    } catch (err) {
      console.error('Failed manual sync:', err);
    } finally {
      setManualSyncing(false);
    }
  };

  // Format Date and Time
  const dayStr = currentTime?.toLocaleDateString('en-IN', { weekday: 'long' }) || '';
  const dateStr = currentTime?.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) || '';
  const timeStr = currentTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) || '';

  return (
    <div className="flex-grow flex flex-col justify-between bg-white min-h-screen">
      {/* Top Header */}
      <div className="bg-blue-600 px-6 pt-8 pb-10 rounded-b-[24px] text-white shadow-md shadow-blue-100 relative">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight uppercase">
              {(settings.shop_name as string) || 'BHAWANI ENTERPRISES'}
            </h1>
            <div className="mt-2 text-xs font-semibold text-blue-150/90 space-y-0.5">
              <p>{dayStr}</p>
              <p className="text-sm text-white font-bold">{dateStr}</p>
              <p className="text-xs text-blue-100">{timeStr}</p>
            </div>
          </div>
          
          {/* Offline Sync State Display */}
          <button
            onClick={handleManualSyncClick}
            disabled={manualSyncing || syncStatus === 'pending'}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold text-white hover:bg-white/20 active:scale-95 transition-all outline-none border border-transparent focus:outline-none"
            title="Force Pull Sync from Server"
          >
            {manualSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-200" />
                <span className="text-blue-100 font-bold">Syncing...</span>
              </>
            ) : syncStatus === 'pending' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span className="text-amber-300 font-bold">Pending Sync</span>
              </>
            ) : syncStatus === 'synced' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span className="text-emerald-100">Synced</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                <span className="text-slate-200">Local Mode</span>
              </>
            )}
          </button>
        </div>

        {/* Today's & Monthly Profit Banner Cards */}
        <div className="mt-5 grid grid-cols-2 gap-4 pt-4 border-t border-blue-500/35">
          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10 flex flex-col">
            <span className="text-[10px] font-extrabold text-blue-200 uppercase tracking-wider block">Today's Profit</span>
            <span className="text-base font-black text-white block mt-0.5">
              ₹{todayProfit.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10 flex flex-col">
            <span className="text-[10px] font-extrabold text-blue-200 uppercase tracking-wider block">Monthly Profit</span>
            <span className="text-base font-black text-white block mt-0.5">
              ₹{monthlyProfit.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-5 -mt-6 flex-1 flex flex-col justify-start gap-6 pb-24">
        {/* Service Grid Card container */}
        <div className="bg-white rounded-[24px] p-5 shadow-lg shadow-slate-100 border border-slate-100">
          <div className="grid grid-cols-3 gap-y-6 gap-x-3">
            {services.map((svc) => (
              <Link
                key={svc.id}
                href={`/transaction/${svc.id}`}
                className="flex flex-col items-center justify-center text-center p-2 rounded-2xl active:bg-slate-50 transition-all active:scale-[0.96]"
              >
                <ServiceLogo type={svc.type} color={svc.color} />
                <span className="mt-2 text-[11px] font-bold text-slate-800 leading-tight">
                  {svc.name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Wallet Balances Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-800">
              WALLET BALANCES
            </h2>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleHideBalances}
                className="text-slate-500 hover:text-slate-700 transition-all active:scale-90"
              >
                {hideBalances ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              <Link
                href="/wallets"
                className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-0.5"
              >
                View All <span className="text-[10px] font-black">&gt;</span>
              </Link>
            </div>
          </div>

          {/* Horizontally Scrollable Row */}
          <div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x scrollbar-none">
            {/* Cash in Shop Balance Card (Always First) */}
            <div
              className="flex-shrink-0 w-36 border rounded-[20px] p-4 snap-start shadow-sm flex flex-col justify-between transition-all"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.07)',
                borderColor: 'rgba(16, 185, 129, 0.15)'
              }}
            >
              <div className="flex justify-between items-start">
                <WalletIcon name="cash" icon="cash" color="#10b981" />
              </div>
              <div className="mt-4">
                <span className="text-[11px] font-bold text-slate-700 tracking-wide block">Cash in Shop</span>
                <span className="text-[16px] font-black mt-1 block truncate" style={{ color: '#16a34a' }}>
                  {formatBalance(cashBalance)}
                </span>
              </div>
            </div>

            {/* Wallet Balances */}
            {wallets
              .filter(w => !['phonepe', 'google pay', 'gpay', 'navi'].includes(w.name.toLowerCase().trim()))
              .map((wallet) => (
              <div
                key={wallet.id}
                className="flex-shrink-0 w-36 border rounded-[20px] p-4 snap-start shadow-sm flex flex-col justify-between transition-all"
                style={{
                  backgroundColor: wallet.color ? `${wallet.color}0A` : '#f8fafc',
                  borderColor: wallet.color ? `${wallet.color}1E` : '#e2e8f0'
                }}
              >
                <div className="flex justify-between items-start">
                  <WalletIcon name={wallet.name} icon={wallet.icon} color={wallet.color} />
                </div>
                <div className="mt-4">
                  <span className="text-[11px] font-bold text-slate-700 tracking-wide block truncate">
                    {wallet.name}
                  </span>
                  <span
                    className="text-[16px] font-black mt-1 block truncate"
                    style={{ color: wallet.color || '#1e293b' }}
                  >
                    {formatBalance(walletBalances[wallet.id] || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation and structural Layout bounds */}
      <BottomNav />
    </div>
  );
}
