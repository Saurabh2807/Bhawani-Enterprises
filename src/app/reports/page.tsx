'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { ArrowLeft, Calendar, FileText, FileDown, ShieldAlert, BadgeAlert } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Label } from '@/components/ui/label';


export default function ReportsPage() {
  const router = useRouter();
  const { isLoaded, transactions, services, wallets, settings, cashBalance, walletBalances } = useDatabase();

  const [period, setPeriod] = useState<'today' | 'yesterday' | 'month' | 'custom'>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handlePeriodChange = (p: 'today' | 'yesterday' | 'month' | 'custom') => {
    setPeriod(p);
    if (p !== 'custom') {
      setCustomStart('');
      setCustomEnd('');
    }
  };

  const reportData = useMemo(() => {
    const getLocalYYYYMMDD = (date: Date = new Date()) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const todayObj = new Date();
    const todayStr = getLocalYYYYMMDD(todayObj);
    
    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = getLocalYYYYMMDD(yesterdayObj);

    const startOfThisMonthObj = new Date(todayObj.getFullYear(), todayObj.getMonth(), 1);
    const startOfThisMonthStr = getLocalYYYYMMDD(startOfThisMonthObj);

    // Filter active transactions for this range
    const filteredTxs = transactions.filter((tx) => {
      if (tx.is_deleted === 1) return false;

      if (period === 'today') {
        return tx.transaction_date === todayStr;
      } else if (period === 'yesterday') {
        return tx.transaction_date === yesterdayStr;
      } else if (period === 'month') {
        return tx.transaction_date >= startOfThisMonthStr && tx.transaction_date <= todayStr;
      } else if (period === 'custom') {
        if (customStart && tx.transaction_date < customStart) return false;
        if (customEnd && tx.transaction_date > customEnd) return false;
        return true;
      }
      return true;
    });

    // Compute metrics
    let totalVolume = 0;
    const transactionsCount = filteredTxs.length;

    // Segmented Volume and Counts
    let rechargeVol = 0;
    let rechargeCount = 0;
    let aepsVol = 0;
    let aepsCount = 0;
    let mtVol = 0;
    let mtCount = 0;
    let electricityVol = 0;
    let electricityCount = 0;
    let loanVol = 0;
    let loanCount = 0;
    let loadVol = 0;
    let loadCount = 0;
    let othersVol = 0;
    let othersCount = 0;

    // Segmented Commissions (Profits)
    let totalProfit = 0;
    let profitRecharge = 0;
    let profitAeps = 0;
    let profitMt = 0;
    let profitElectricity = 0;
    let profitLoan = 0;
    let profitWalletLoad = 0;
    let profitOthers = 0;

    filteredTxs.forEach((tx) => {
      totalVolume += tx.amount;
      const commVal = tx.commission || 0;
      totalProfit += commVal;

      const svc = services.find((s) => s.id === tx.service_id);
      
      if (svc) {
        const type = svc.type;
        if (type.includes('recharge')) {
          rechargeVol += tx.amount;
          rechargeCount++;
          profitRecharge += commVal;
        } else if (type === 'aeps_withdrawal') {
          aepsVol += tx.amount;
          aepsCount++;
          profitAeps += commVal;
        } else if (type === 'money_transfer') {
          mtVol += tx.amount;
          mtCount++;
          profitMt += commVal;
        } else if (type === 'electricity_bill') {
          electricityVol += tx.amount;
          electricityCount++;
          profitElectricity += commVal;
        } else if (type === 'loan_repayment') {
          loanVol += tx.amount;
          loanCount++;
          profitLoan += commVal;
        } else {
          othersVol += tx.amount;
          othersCount++;
          profitOthers += commVal;
        }
      } else {
        if (tx.notes === 'Wallet Load' || tx.notes === 'Operator Commission') {
          loadVol += tx.amount;
          loadCount++;
          profitWalletLoad += commVal;
        } else {
          othersVol += tx.amount;
          othersCount++;
          profitOthers += commVal;
        }
      }
    });

    return {
      transactionsList: filteredTxs,
      count: transactionsCount,
      volume: totalVolume,
      rechargeVol,
      rechargeCount,
      aepsVol,
      aepsCount,
      mtVol,
      mtCount,
      electricityVol,
      electricityCount,
      loanVol,
      loanCount,
      loadVol,
      loadCount,
      othersVol,
      othersCount,
      totalProfit,
      profitRecharge,
      profitAeps,
      profitMt,
      profitElectricity,
      profitLoan,
      profitWalletLoad,
      profitOthers
    };
  }, [transactions, period, customStart, customEnd, services]);

  const totalProfitOverall = useMemo(() => {
    return transactions
      .filter((tx) => tx.is_deleted === 0)
      .reduce((sum, tx) => sum + (tx.commission || 0), 0);
  }, [transactions]);

  const todayProfitOverall = useMemo(() => {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    return transactions
      .filter((tx) => tx.is_deleted === 0 && tx.transaction_date === todayStr)
      .reduce((sum, tx) => sum + (tx.commission || 0), 0);
  }, [transactions]);

  const monthlyProfitOverall = useMemo(() => {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${y}-${m}`;
    return transactions
      .filter((tx) => tx.is_deleted === 0 && tx.transaction_date && tx.transaction_date.startsWith(monthPrefix))
      .reduce((sum, tx) => sum + (tx.commission || 0), 0);
  }, [transactions]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const shopName = (settings.shop_name as string) || 'BHAWANI ENTERPRISES';
      const nowStr = new Date().toLocaleString('en-IN');

      // Shop Name
      doc.setFontSize(22);
      doc.setTextColor(29, 78, 216); // Royal Blue
      doc.setFont('helvetica', 'bold');
      doc.text(shopName, 14, 18);

      // Subtitle
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text('Business Summary & Ledger Report', 14, 25);

      // Meta block
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const periodLabel = period === 'today' ? 'Today' : period === 'yesterday' ? 'Yesterday' : period === 'month' ? 'This Month' : `${customStart || 'Start'} to ${customEnd || 'End'}`;
      doc.text(`Report Period: ${periodLabel}`, 14, 32);
      doc.text(`Generated On: ${nowStr}`, 14, 37);

      // Section: Key Totals
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Business Performance Summary', 14, 46);

      // Draw box for metrics
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 50, 182, 40, 'FD');

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text('Total Volume', 20, 56);
      doc.text('Total Transactions', 80, 56);
      doc.text('Selected Period Profit', 140, 56);
      
      doc.text("Today's Profit", 20, 76);
      doc.text('Monthly Profit', 80, 76);
      doc.text('Total Accumulated Profit', 140, 76);

      doc.setFontSize(11);
      doc.setTextColor(29, 78, 216);
      doc.setFont('helvetica', 'bold');
      doc.text(`₹${reportData.volume.toLocaleString('en-IN')}`, 20, 65);
      doc.text(`${reportData.count}`, 80, 65);
      doc.text(`₹${reportData.totalProfit.toLocaleString('en-IN')}`, 140, 65);
      
      doc.setTextColor(5, 150, 105); // Green for profit
      doc.text(`₹${todayProfitOverall.toLocaleString('en-IN')}`, 20, 85);
      doc.text(`₹${monthlyProfitOverall.toLocaleString('en-IN')}`, 80, 85);
      doc.setTextColor(15, 23, 42); // Black/grey
      doc.text(`₹${totalProfitOverall.toLocaleString('en-IN')}`, 140, 85);

      // Section: Service Breakdown Table
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Service Volume & Profit Breakdown', 14, 98);

      const serviceRows = [
        ['Mobile Recharges', `${reportData.rechargeCount}`, `₹${reportData.rechargeVol.toLocaleString('en-IN')}`, `₹${reportData.profitRecharge.toLocaleString('en-IN')}`],
        ['AEPS Cash Withdrawals', `${reportData.aepsCount}`, `₹${reportData.aepsVol.toLocaleString('en-IN')}`, `₹${reportData.profitAeps.toLocaleString('en-IN')}`],
        ['Money Transfers', `${reportData.mtCount}`, `₹${reportData.mtVol.toLocaleString('en-IN')}`, `₹${reportData.profitMt.toLocaleString('en-IN')}`],
        ['Electricity Bills', `${reportData.electricityCount}`, `₹${reportData.electricityVol.toLocaleString('en-IN')}`, `₹${reportData.profitElectricity.toLocaleString('en-IN')}`],
        ['Loan Repayments', `${reportData.loanCount}`, `₹${reportData.loanVol.toLocaleString('en-IN')}`, `₹${reportData.profitLoan.toLocaleString('en-IN')}`],
        ['Wallet Loads & Commissions', `${reportData.loadCount}`, `₹${reportData.loadVol.toLocaleString('en-IN')}`, `₹${reportData.profitWalletLoad.toLocaleString('en-IN')}`],
        ['Other Services', `${reportData.othersCount}`, `₹${reportData.othersVol.toLocaleString('en-IN')}`, `₹${reportData.profitOthers.toLocaleString('en-IN')}`]
      ];

      autoTable(doc, {
        startY: 102,
        head: [['Service Type', 'Count', 'Volume', 'Profit']],
        body: serviceRows,
        theme: 'striped',
        headStyles: { fillColor: [5, 150, 105], fontStyle: 'bold' },
        styles: { fontSize: 8 }
      });

      // Section: Closing Asset Balances
      const nextStartY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Closing Ledger Account Balances', 14, nextStartY);

      const walletRows = [
        ['Cash in Shop', `₹${cashBalance.toLocaleString('en-IN')}`]
      ];
      wallets.forEach((w) => {
        walletRows.push([w.name, `₹${(walletBalances[w.id] || 0).toLocaleString('en-IN')}`]);
      });

      autoTable(doc, {
        startY: nextStartY + 4,
        head: [['Asset Account', 'Closing Balance']],
        body: walletRows,
        theme: 'striped',
        headStyles: { fillColor: [29, 78, 216], fontStyle: 'bold' },
        styles: { fontSize: 8 }
      });

      // Section: Detailed Transactions List
      const nextStartY2 = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('4. Transaction Ledger Details', 14, nextStartY2);

      const txRows = reportData.transactionsList.map((tx) => {
        const d = new Date(tx.created_at);
        const dStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        const serviceName = services.find((s) => s.id === tx.service_id)?.name || (tx.notes?.includes('Transfer') ? 'Wallet Transfer' : 'System Adjust');
        const walletName = wallets.find((w) => w.id === tx.wallet_id)?.name || 'Cash';
        const formattedAmount = `₹${tx.amount.toLocaleString('en-IN')}`;
        const formattedCommission = `₹${(tx.commission || 0).toLocaleString('en-IN')}`;

        return [
          dStr,
          tx.transaction_number,
          serviceName,
          walletName,
          formattedAmount,
          formattedCommission
        ];
      });

      autoTable(doc, {
        startY: nextStartY2 + 4,
        head: [['Date/Time', 'Tx No', 'Service/Action', 'Wallet/Cash', 'Amount', 'Commission']],
        body: txRows,
        theme: 'striped',
        headStyles: { fillColor: [71, 85, 105], fontStyle: 'bold' },
        styles: { fontSize: 7 }
      });

      // Save PDF
      doc.save(`report_${period}_${Date.now()}.pdf`);
    } catch (err) {
      console.error('Failed to export report PDF:', err);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500">Generating report data...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col justify-between bg-white min-h-screen">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 bg-white sticky top-0 z-10">
        <button
          onClick={() => router.push('/')}
          className="p-2 text-slate-600 hover:text-slate-900 active:scale-95 transition-all rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5px]" />
        </button>
        <span className="text-base font-extrabold text-slate-800">Business Reports</span>
        
        {/* Export Button */}
        <button
          onClick={handleExportPDF}
          disabled={reportData.count === 0}
          className="p-2 text-blue-600 hover:text-blue-800 active:scale-95 transition-all rounded-lg flex items-center gap-1 text-sm font-bold disabled:opacity-40"
        >
          <FileDown className="w-5 h-5 stroke-[2.5px]" />
          <span>Export</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 p-5 flex flex-col gap-5 overflow-y-auto pb-24">
        
        {/* Period selection grid */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Report Period</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['today', 'yesterday', 'month', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`h-9 border rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.97] ${
                  period === p
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p === 'month' ? 'This Month' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date inputs */}
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-150 animate-fadeIn">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Start Date</label>
              <input
                type="date"
                className="w-full h-10 px-2.5 rounded-xl border border-slate-250 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">End Date</label>
              <input
                type="date"
                className="w-full h-10 px-2.5 rounded-xl border border-slate-250 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Summary Card Block */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-5 text-white shadow-lg shadow-blue-100 space-y-4">
          <div>
            <span className="text-[10px] font-bold text-blue-150 uppercase tracking-widest">Total Transaction Volume</span>
            <h2 className="text-3xl font-black mt-1">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(reportData.volume)}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
            <div>
              <span className="text-[9px] font-bold text-blue-200 uppercase tracking-widest block">Transactions</span>
              <span className="text-lg font-extrabold mt-0.5 block">{reportData.count} entries</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-blue-200 uppercase tracking-widest block">Avg Ticket Size</span>
              <span className="text-lg font-extrabold mt-0.5 block">
                ₹{reportData.count > 0 ? Math.round(reportData.volume / reportData.count).toLocaleString('en-IN') : 0}
              </span>
            </div>
          </div>
        </div>

        {/* KPI profit cards grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col shadow-sm">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Today's Profit</span>
            <span className="text-xl font-black text-emerald-600 mt-1 block">
              ₹{todayProfitOverall.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col shadow-sm">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Monthly Profit</span>
            <span className="text-xl font-black text-emerald-600 mt-1 block">
              ₹{monthlyProfitOverall.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col shadow-sm">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Period Profit</span>
            <span className="text-xl font-black text-blue-600 mt-1 block">
              ₹{reportData.totalProfit.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col shadow-sm">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Profit</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">
              ₹{totalProfitOverall.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Services Performance Breakdown list */}
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-1">Service Volume & Profit Breakdown</h3>
          
          <div className="space-y-2">
            {/* Recharge */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <span className="text-sm font-extrabold text-slate-800">Mobile Recharges</span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">{reportData.rechargeCount} transactions</span>
                <span className="text-[10px] font-extrabold text-emerald-600 block mt-1">Profit: ₹{reportData.profitRecharge.toLocaleString('en-IN')}</span>
              </div>
              <span className="text-base font-black text-slate-800">
                ₹{reportData.rechargeVol.toLocaleString('en-IN')}
              </span>
            </div>

            {/* AEPS */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <span className="text-sm font-extrabold text-slate-800">AEPS Cash Withdrawals</span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">{reportData.aepsCount} transactions</span>
                <span className="text-[10px] font-extrabold text-emerald-600 block mt-1">Profit: ₹{reportData.profitAeps.toLocaleString('en-IN')}</span>
              </div>
              <span className="text-base font-black text-slate-800">
                ₹{reportData.aepsVol.toLocaleString('en-IN')}
              </span>
            </div>

            {/* MT */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <span className="text-sm font-extrabold text-slate-800">Money Transfers</span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">{reportData.mtCount} transactions</span>
                <span className="text-[10px] font-extrabold text-emerald-600 block mt-1">Profit: ₹{reportData.profitMt.toLocaleString('en-IN')}</span>
              </div>
              <span className="text-base font-black text-slate-800">
                ₹{reportData.mtVol.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Electricity */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <span className="text-sm font-extrabold text-slate-800">Electricity Bills</span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">{reportData.electricityCount} transactions</span>
                <span className="text-[10px] font-extrabold text-emerald-600 block mt-1">Profit: ₹{reportData.profitElectricity.toLocaleString('en-IN')}</span>
              </div>
              <span className="text-base font-black text-slate-800">
                ₹{reportData.electricityVol.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Loan Repayments */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <span className="text-sm font-extrabold text-slate-800">Loan Repayments</span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">{reportData.loanCount} transactions</span>
                <span className="text-[10px] font-extrabold text-emerald-600 block mt-1">Profit: ₹{reportData.profitLoan.toLocaleString('en-IN')}</span>
              </div>
              <span className="text-base font-black text-slate-800">
                ₹{reportData.loanVol.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Loads */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <span className="text-sm font-extrabold text-slate-800">Wallet Loading Slabs</span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">{reportData.loadCount} entries</span>
                <span className="text-[10px] font-extrabold text-emerald-600 block mt-1">Profit: ₹{reportData.profitWalletLoad.toLocaleString('en-IN')}</span>
              </div>
              <span className="text-base font-black text-slate-800">
                ₹{reportData.loadVol.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Others */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <span className="text-sm font-extrabold text-slate-800">Others</span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">{reportData.othersCount} entries</span>
                <span className="text-[10px] font-extrabold text-emerald-600 block mt-1">Profit: ₹{reportData.profitOthers.toLocaleString('en-IN')}</span>
              </div>
              <span className="text-base font-black text-slate-800">
                ₹{reportData.othersVol.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Generate Report prompt */}
        {reportData.count > 0 ? (
          <button
            onClick={handleExportPDF}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-100 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2"
          >
            <FileText className="w-5 h-5 stroke-[2.2px]" />
            Download Detailed Report PDF
          </button>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <BadgeAlert className="w-8 h-8 text-slate-300 stroke-[1.5]" />
            <p className="mt-2 text-xs font-semibold text-slate-400 text-center px-6">
              No transactions recorded for this period. Add transactions to generate PDF.
            </p>
          </div>
        )}
      </div>

      {/* Navigation bar layout */}
      <BottomNav />
    </div>
  );
}
