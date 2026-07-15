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

  // Reset custom dates on period change
  useEffect(() => {
    if (period !== 'custom') {
      setCustomStart('');
      setCustomEnd('');
    }
  }, [period]);

  const reportData = useMemo(() => {
    // Filter active transactions for this range
    const filteredTxs = transactions.filter((tx) => {
      if (tx.deleted_at !== null) return false;

      const txDate = new Date(tx.created_at);
      const today = new Date();
      
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      
      const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      const endOfYesterday = new Date(endOfToday.getTime() - 24 * 60 * 60 * 1000);
      
      const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      if (period === 'today') {
        return txDate >= startOfToday && txDate <= endOfToday;
      } else if (period === 'yesterday') {
        return txDate >= startOfYesterday && txDate <= endOfYesterday;
      } else if (period === 'month') {
        return txDate >= startOfThisMonth && txDate <= endOfToday;
      } else if (period === 'custom') {
        if (customStart) {
          const start = new Date(customStart);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) return false;
        }
        if (customEnd) {
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
        return true;
      }
      return true;
    });

    // Compute metrics
    let totalVolume = 0;
    let transactionsCount = filteredTxs.length;

    // Recharge debit count/volume
    let rechargeVol = 0;
    let rechargeCount = 0;
    
    // AEPS volume
    let aepsVol = 0;
    let aepsCount = 0;

    // Money Transfer volume
    let mtVol = 0;
    let mtCount = 0;

    // Others
    let otherVol = 0;
    let otherCount = 0;

    filteredTxs.forEach((tx) => {
      totalVolume += tx.amount;
      const svc = services.find((s) => s.id === tx.service_id);
      
      if (svc?.type.includes('recharge')) {
        rechargeVol += tx.amount;
        rechargeCount++;
      } else if (svc?.type === 'aeps_withdrawal') {
        aepsVol += tx.amount;
        aepsCount++;
      } else if (svc?.type === 'money_transfer') {
        mtVol += tx.amount;
        mtCount++;
      } else {
        otherVol += tx.amount;
        otherCount++;
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
      otherVol,
      otherCount
    };
  }, [transactions, period, customStart, customEnd, services]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const shopName = settings.shop_name || 'BHAWANI ENTERPRISES';
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
      doc.text('1. Business Performance', 14, 46);

      // Draw box for metrics
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 50, 182, 28, 'FD');

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text('Total Volume', 20, 58);
      doc.text('Total Transactions', 85, 58);
      doc.text('Avg Ticket Size', 145, 58);

      doc.setFontSize(14);
      doc.setTextColor(29, 78, 216);
      doc.setFont('helvetica', 'bold');
      doc.text(`₹${reportData.volume.toLocaleString('en-IN')}`, 20, 68);
      doc.text(`${reportData.count}`, 85, 68);
      doc.text(`₹${reportData.count > 0 ? Math.round(reportData.volume / reportData.count).toLocaleString('en-IN') : 0}`, 145, 68);

      // Section: Wallets closing balances
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Closing Ledger Balances', 14, 88);

      const walletRows = [
        ['Cash in Shop', `₹${cashBalance.toLocaleString('en-IN')}`]
      ];
      wallets.forEach((w) => {
        walletRows.push([w.name, `₹${(walletBalances[w.id] || 0).toLocaleString('en-IN')}`]);
      });

      autoTable(doc, {
        startY: 92,
        head: [['Asset Account', 'Closing Balance']],
        body: walletRows,
        theme: 'striped',
        headStyles: { fillColor: [29, 78, 216], fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      // Section: Detailed Transactions List
      const nextStartY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Transaction Ledger Details', 14, nextStartY);

      const txRows = reportData.transactionsList.map((tx) => {
        const d = new Date(tx.created_at);
        const dStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        const serviceName = services.find((s) => s.id === tx.service_id)?.name || (tx.notes?.includes('Transfer') ? 'Wallet Transfer' : 'System Adjust');
        const walletName = wallets.find((w) => w.id === tx.wallet_id)?.name || 'Cash';
        const formattedAmount = `₹${tx.amount.toLocaleString('en-IN')}`;

        return [
          dStr,
          tx.transaction_number,
          serviceName,
          walletName,
          formattedAmount,
          tx.notes || '-'
        ];
      });

      autoTable(doc, {
        startY: nextStartY + 4,
        head: [['Date/Time', 'Tx No', 'Service/Action', 'Wallet/Cash', 'Amount', 'Notes']],
        body: txRows,
        theme: 'striped',
        headStyles: { fillColor: [29, 78, 216], fontStyle: 'bold' },
        styles: { fontSize: 8 }
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
                onClick={() => setPeriod(p)}
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

        {/* Services Performance Breakdown list */}
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-1">Service Volume Summary</h3>
          
          <div className="space-y-2">
            {/* Recharge */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <span className="text-sm font-extrabold text-slate-800">Mobile Recharges</span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">{reportData.rechargeCount} transactions</span>
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
              </div>
              <span className="text-base font-black text-slate-800">
                ₹{reportData.mtVol.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Others */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <span className="text-sm font-extrabold text-slate-800">Bills & Others</span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">{reportData.otherCount} transactions</span>
              </div>
              <span className="text-base font-black text-slate-800">
                ₹{reportData.otherVol.toLocaleString('en-IN')}
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
