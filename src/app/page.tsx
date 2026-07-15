'use client';

import React, { useState, useEffect } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { useAuth } from '@/context/AuthContext';
import { SetupWizard } from '@/components/setup/SetupWizard';
import { BottomNav } from '@/components/layout/BottomNav';
import Link from 'next/link';
import { Eye, EyeOff, Smartphone, Zap, Search, CreditCard, Landmark, RefreshCw } from 'lucide-react';

// Service Logo / Icon Mapper for Fintech feel
const ServiceLogo = ({ type, color }: { type: string; color?: string }) => {
  const fillCol = color || '#1d4ed8';

  switch (type) {
    case 'jio_recharge':
      return (
        <div className="w-12 h-12 rounded-full bg-[#0f3cc9] flex items-center justify-center shadow-sm">
          <span className="text-white font-extrabold text-[15px] italic tracking-tight">Jio</span>
        </div>
      );
    case 'airtel_recharge':
      return (
        <div className="w-12 h-12 rounded-full bg-[#e21226] flex items-center justify-center shadow-sm relative overflow-hidden">
          {/* Airtel 'a' logo representation */}
          <span className="text-white font-black text-xl leading-none">a</span>
        </div>
      );
    case 'vi_recharge':
      return (
        <div className="w-12 h-12 rounded-full bg-[#eb0029] flex items-center justify-center shadow-sm">
          <span className="text-white font-black text-lg italic leading-none">vi</span>
        </div>
      );
    case 'bsnl_recharge':
      return (
        <div className="w-12 h-12 rounded-full bg-[#0f68b3] flex items-center justify-center shadow-sm relative">
          <div className="absolute inset-2 bg-yellow-400 rounded-full flex items-center justify-center">
            <span className="text-[#0f68b3] font-extrabold text-[9px] tracking-tighter">BSNL</span>
          </div>
        </div>
      );
    case 'aeps_withdrawal':
      return (
        <div className="w-12 h-12 rounded-full bg-[#e6fcf5] flex items-center justify-center text-[#10b981] shadow-sm">
          <svg className="w-6 h-6 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 0 0-7.3 3.1" />
            <path d="M12 2a10 10 0 0 1 7.3 3.1" />
            <path d="M12 2v20" />
            <path d="M17 12a5 5 0 0 1-5 5" />
            <path d="M12 7a5 5 0 0 1 5 5" />
            <path d="M12 17a5 5 0 0 1-5-5" />
            <path d="M7 12a5 5 0 0 1 5-5" />
          </svg>
        </div>
      );
    case 'money_transfer':
      return (
        <div className="w-12 h-12 rounded-full bg-[#eff6ff] flex items-center justify-center text-[#3b82f6] shadow-sm">
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
        <div className="w-12 h-12 rounded-full bg-[#f0fdfa] flex items-center justify-center text-[#0d9488] shadow-sm">
          <Zap className="w-6 h-6 fill-current stroke-[2.5]" />
        </div>
      );
    case 'balance_enquiry':
      return (
        <div className="w-12 h-12 rounded-full bg-[#fff7ed] flex items-center justify-center text-[#f97316] shadow-sm">
          <Search className="w-6 h-6 stroke-[2.5]" />
        </div>
      );
    case 'loan_repayment':
      return (
        <div className="w-12 h-12 rounded-full bg-[#faf5ff] flex items-center justify-center text-[#8b5cf6] shadow-sm">
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
  
  const bgCol = color ? `${color}1A` : 'rgba(71, 85, 105, 0.1)'; // 10% opacity
  const textCol = color || '#475569';
  
  if (cleanIcon === 'cash' || cleanName.includes('cash')) {
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold" style={{ backgroundColor: bgCol, color: textCol }}>
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
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-[11px]" style={{ backgroundColor: bgCol, color: textCol }}>
        FN
      </div>
    );
  }
  if (cleanIcon === 'jio' || cleanName.includes('jio')) {
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[10px] italic" style={{ backgroundColor: bgCol, color: textCol }}>
        Jio
      </div>
    );
  }
  if (cleanIcon === 'airtel' || cleanName.includes('airtel') || cleanName.includes('lapu')) {
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs" style={{ backgroundColor: bgCol, color: textCol }}>
        a
      </div>
    );
  }
  if (cleanIcon === 'phonepe' || cleanName.includes('phonepe')) {
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px]" style={{ backgroundColor: bgCol, color: textCol }}>
        PP
      </div>
    );
  }
  if (cleanIcon === 'google-pay' || cleanIcon === 'gpay' || cleanName.includes('google') || cleanName.includes('gpay')) {
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px]" style={{ backgroundColor: bgCol, color: textCol }}>
        G
      </div>
    );
  }
  if (cleanIcon === 'spice-money' || cleanName.includes('spice')) {
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px]" style={{ backgroundColor: bgCol, color: textCol }}>
        SP
      </div>
    );
  }
  
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: bgCol, color: textCol }}>
      <CreditCard className="w-5 h-5" />
    </div>
  );
};

export default function HomePage() {
  const { isLoaded, settings, services, wallets, cashBalance, walletBalances, syncStatus } = useDatabase();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [hideBalances, setHideBalances] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bhawani_hide_balances') === 'true';
    }
    return false;
  });

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
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold">
            {syncStatus === 'pending' && (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span className="text-amber-300 font-bold">Pending Sync</span>
              </>
            )}
            {syncStatus === 'synced' && (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span className="text-emerald-100">Synced</span>
              </>
            )}
            {syncStatus === 'local_only' && (
              <>
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                <span className="text-slate-200">Local Mode</span>
              </>
            )}
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
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-slate-400 flex items-center gap-2">
              Wallet Balances
            </h2>
            <button
              onClick={toggleHideBalances}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
            >
              {hideBalances ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Horizontally Scrollable Row */}
          <div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x scrollbar-none">
            {/* Cash in Shop Balance Card (Always First) */}
            <div className="flex-shrink-0 w-36 bg-slate-50/80 border border-slate-100 rounded-[20px] p-4 snap-start shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <WalletIcon name="cash" icon="cash" color="#10b981" />
              </div>
              <div className="mt-4">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Cash in Shop</span>
                <span className="text-[16px] font-black text-slate-800 mt-1 block truncate">
                  {formatBalance(cashBalance)}
                </span>
              </div>
            </div>

            {/* Wallet Balances */}
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex-shrink-0 w-36 bg-slate-50/80 border border-slate-100 rounded-[20px] p-4 snap-start shadow-sm flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <WalletIcon name={wallet.name} icon={wallet.icon} color={wallet.color} />
                </div>
                <div className="mt-4">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block truncate">
                    {wallet.name}
                  </span>
                  <span className="text-[16px] font-black text-slate-800 mt-1 block truncate">
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
