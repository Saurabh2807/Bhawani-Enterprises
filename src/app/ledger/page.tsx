'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { Search, Calendar, Filter, FileDown, ArrowLeft, RefreshCw, X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Main Ledger Component wrapped with Suspense to handle useSearchParams safely in Next.js
function LedgerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultServiceId = searchParams.get('serviceId') || '';
  const defaultWalletId = searchParams.get('walletId') || '';

  const { isLoaded, transactions, services, wallets, settings, deleteTransaction } = useDatabase();

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [walletFilter, setWalletFilter] = useState<string>(defaultWalletId || 'ALL'); // 'ALL' | 'CASH' | walletId
  const [serviceFilter, setServiceFilter] = useState<string>(defaultServiceId || 'ALL'); // 'ALL' | serviceId

  // Sync state filter from search params if it changes
  useEffect(() => {
    if (defaultServiceId) {
      const timer = setTimeout(() => setServiceFilter(defaultServiceId), 0);
      return () => clearTimeout(timer);
    }
  }, [defaultServiceId]);

  const handleDateFilterChange = (filter: 'today' | 'yesterday' | 'custom') => {
    setDateFilter(filter);
    if (filter !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const filteredTransactions = useMemo(() => {
    const getLocalYYYYMMDD = (date: Date = new Date()) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const todayStr = getLocalYYYYMMDD();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalYYYYMMDD(yesterday);

    // Exclude soft-deleted transactions
    return transactions.filter((tx) => {
      if (tx.is_deleted === 1) return false;

      // 1. Service Filter
      if (serviceFilter !== 'ALL') {
        if (tx.service_id !== serviceFilter) return false;
      }

      // 2. Wallet Filter
      if (walletFilter !== 'ALL') {
        if (walletFilter === 'CASH') {
          if (tx.wallet_id !== null) return false;
        } else {
          if (tx.wallet_id !== walletFilter) return false;
        }
      }

      // 3. Date Filter using optimized transaction_date comparison
      if (dateFilter === 'today') {
        if (tx.transaction_date !== todayStr) return false;
      } else if (dateFilter === 'yesterday') {
        if (tx.transaction_date !== yesterdayStr) return false;
      } else if (dateFilter === 'custom') {
        if (customStartDate && tx.transaction_date < customStartDate) return false;
        if (customEndDate && tx.transaction_date > customEndDate) return false;
      }

      // 4. Search Filter (Search amount, transaction number, notes, or service name)
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const sName = services.find((s) => s.id === tx.service_id)?.name.toLowerCase() || 'transfer';
        const wName = wallets.find((w) => w.id === tx.wallet_id)?.name.toLowerCase() || 'cash';
        
        const matchTxNum = tx.transaction_number.toLowerCase().includes(query);
        const matchNotes = tx.notes?.toLowerCase().includes(query) || false;
        const matchAmt = tx.amount.toString().includes(query);
        const matchService = sName.includes(query);
        const matchWallet = wName.includes(query);

        if (!matchTxNum && !matchNotes && !matchAmt && !matchService && !matchWallet) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, serviceFilter, walletFilter, dateFilter, customStartDate, customEndDate, searchTerm, services, wallets]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const shopName = (settings.shop_name as string) || 'BHAWANI ENTERPRISES';
      
      // Header Section
      doc.setFontSize(20);
      doc.setTextColor(29, 78, 216); // Royal Blue
      doc.text(shopName, 14, 15);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // Slate Gray
      doc.text('Transaction Ledger Report', 14, 22);

      // Filters summary
      const filterText = `Date: ${dateFilter === 'today' ? 'Today' : dateFilter === 'yesterday' ? 'Yesterday' : `${customStartDate || 'Start'} to ${customEndDate || 'End'}`} | Wallet: ${walletFilter === 'ALL' ? 'All' : walletFilter === 'CASH' ? 'Cash' : wallets.find(w => w.id === walletFilter)?.name} | Service: ${serviceFilter === 'ALL' ? 'All' : services.find(s => s.id === serviceFilter)?.name}`;
      doc.setFontSize(9);
      doc.text(filterText, 14, 28);
      
      // Draw a line
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 31, 196, 31);

      // Prepare Table Data
      const tableRows = filteredTransactions.map((tx) => {
        const dateObj = new Date(tx.created_at);
        const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        const serviceName = services.find((s) => s.id === tx.service_id)?.name || (tx.notes?.includes('Transfer') ? 'Wallet Transfer' : 'System Adjust');
        const walletName = wallets.find((w) => w.id === tx.wallet_id)?.name || 'Cash';
        const txAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(tx.amount);
        
        return [
          `${dateStr}\n${timeStr}`,
          tx.transaction_number,
          serviceName,
          walletName,
          txAmount,
          tx.notes || '-'
        ];
      });

      // Generate AutoTable
      autoTable(doc, {
        startY: 34,
        head: [['Date & Time', 'Tx Number', 'Service/Action', 'Wallet/Cash', 'Amount', 'Notes']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 25 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 45 }
        }
      });

      // Save PDF
      doc.save(`ledger_${dateFilter}_${Date.now()}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    }
  };

  const getServiceColor = (serviceId: string | null, notes: string | null) => {
    if (notes?.includes('Transfer')) return 'bg-amber-100 text-amber-800';
    if (!serviceId) return 'bg-slate-100 text-slate-800';
    const s = services.find((sv) => sv.id === serviceId);
    return s ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-800';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setWalletFilter('ALL');
    setServiceFilter('ALL');
    handleDateFilterChange('today');
  };

  const totalCollected = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);

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
        <span className="text-base font-extrabold text-slate-800">Transaction Ledger</span>
        
        {/* Export Button */}
        <button
          onClick={handleExportPDF}
          disabled={filteredTransactions.length === 0}
          className="p-2 text-blue-600 hover:text-blue-800 active:scale-95 transition-all rounded-lg flex items-center gap-1 text-sm font-bold disabled:opacity-40"
        >
          <FileDown className="w-5 h-5 stroke-[2.5px]" />
          <span>Export</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto pb-24">
        
        {/* Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <Input
            type="text"
            placeholder="Search Tx, notes, amount..."
            className="pl-9 h-11 border-slate-200 focus-visible:ring-blue-600 rounded-xl font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date Filters Row */}
        <div className="flex gap-2">
          {(['today', 'yesterday', 'custom'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => handleDateFilterChange(filter)}
              className={`flex-1 h-9 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border active:scale-[0.98] ${
                dateFilter === filter
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Custom Date Picker Inputs */}
        {dateFilter === 'custom' && (
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-150 animate-fadeIn">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Start Date</label>
              <input
                type="date"
                className="w-full h-9 px-2 rounded-lg border border-slate-250 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">End Date</label>
              <input
                type="date"
                className="w-full h-9 px-2 rounded-lg border border-slate-250 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Wallet Selector */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Wallet/Cash</span>
            <select
              className="w-full h-10 px-3 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl bg-slate-50 appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                backgroundSize: '12px'
              }}
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
            >
              <option value="ALL">All Wallets</option>
              <option value="CASH">Cash in Shop</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Service Selector */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Service</span>
            <select
              className="w-full h-10 px-3 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl bg-slate-50 appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                backgroundSize: '12px'
              }}
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option value="ALL">All Services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters helper */}
        {(searchTerm || walletFilter !== 'ALL' || serviceFilter !== 'ALL' || dateFilter !== 'today') && (
          <button
            onClick={clearFilters}
            className="text-xs font-bold text-red-500 hover:text-red-700 self-end flex items-center gap-1 mt-1 transition-all active:scale-95"
          >
            Clear Filters
          </button>
        )}

        {/* Results Info and Total Summary */}
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 flex justify-between items-center mt-2">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Found Transactions</span>
            <span className="text-sm font-extrabold text-slate-800">{filteredTransactions.length} items</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filtered Total</span>
            <span className="text-base font-black text-blue-600">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalCollected)}
            </span>
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3 mt-2">
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 rounded-[20px] border border-dashed border-slate-200">
              <Calendar className="w-10 h-10 text-slate-350 stroke-[1.5]" />
              <p className="mt-3 text-sm font-semibold text-slate-400">No transactions match filters.</p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const svc = services.find((s) => s.id === tx.service_id);
              const walletName = wallets.find((w) => w.id === tx.wallet_id)?.name || 'Cash';
              const dateObj = new Date(tx.created_at);
              const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

              return (
                <div
                  key={tx.id}
                  className="bg-white border border-slate-100 rounded-[20px] p-4 flex justify-between items-center shadow-sm relative hover:bg-slate-50/30 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getServiceColor(tx.service_id, tx.notes)}`}>
                        {svc?.name || (tx.notes?.includes('Transfer') ? 'Wallet Transfer' : 'Adjustment')}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{timeStr}</span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-800 mt-2 truncate flex items-center gap-1.5">
                      <span className="text-slate-400 text-xs font-mono font-medium">{tx.transaction_number}</span>
                      {tx.notes && <span className="text-slate-500 font-semibold text-xs truncate">({tx.notes})</span>}
                    </h3>
                    
                    <span className="text-[11px] font-semibold text-slate-400 mt-1 block">
                      Wallet: {walletName}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <span className="text-[15px] font-black text-slate-900 block">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(tx.amount)}
                      </span>
                      <span className={`text-[10px] font-bold ${tx.status === 'synced' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {tx.status === 'synced' ? 'Synced' : 'Pending'}
                      </span>
                    </div>

                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete transaction ${tx.transaction_number}? This will automatically reverse its balance impact.`)) {
                          try {
                            await deleteTransaction(tx.id);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to delete transaction.');
                          }
                        }
                      }}
                      type="button"
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 active:scale-90 transition-all rounded-lg"
                      title="Delete Transaction"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Structural bottom navigation */}
      <BottomNav />
    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-semibold text-slate-500">Loading history...</p>
        </div>
      }
    >
      <LedgerContent />
    </Suspense>
  );
}
