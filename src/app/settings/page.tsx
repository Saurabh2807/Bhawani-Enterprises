'use client';

import React, { useState } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft,
  Settings,
  Store,
  Sliders,
  Wallet,
  Trash2,
  Undo2,
  LogOut,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FolderSync,
  PlusCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const {
    isLoaded,
    settings,
    services,
    wallets,
    transactions,
    updateSetting,
    updateServiceConfig,
    addWallet,
    editWallet,
    deleteWallet,
    reorderWallets,
    restoreTransaction,
    syncStatus,
    isOnline
  } = useDatabase();

  // Active Collapsible Accordion sections
  const [activeSection, setActiveSection] = useState<'profile' | 'services' | 'wallets' | 'deleted' | null>(null);

  // Shop Profile States
  const [shopName, setShopName] = useState(settings.shop_name || '');
  const [shopLogo, setShopLogo] = useState(settings.shop_logo || '');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Service Editing States
  const [editingService, setEditingService] = useState<any | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcColor, setSvcColor] = useState('');
  const [svcActive, setSvcActive] = useState(true);
  const [svcSelection, setSvcSelection] = useState(false);
  const [svcQuickAmts, setSvcQuickAmts] = useState('');
  const [svcError, setSvcError] = useState('');
  const [svcSuccess, setSvcSuccess] = useState(false);

  // Wallet Editing States
  const [editingWallet, setEditingWallet] = useState<any | null>(null);
  const [walName, setWalName] = useState('');
  const [walActive, setWalActive] = useState(true);
  const [walSuccess, setWalSuccess] = useState(false);

  // New Wallet States
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newWalName, setNewWalName] = useState('');
  const [newWalError, setNewWalError] = useState('');

  const toggleSection = (section: 'profile' | 'services' | 'wallets' | 'deleted') => {
    setActiveSection(activeSection === section ? null : section);
  };

  // 1. Profile Handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(false);
    await updateSetting('shop_name', shopName);
    await updateSetting('shop_logo', shopLogo);
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 2000);
  };

  // 2. Service Handlers
  const handleOpenEditService = (svc: any) => {
    setEditingService(svc);
    setSvcName(svc.name);
    setSvcColor(svc.color || '#1d4ed8');
    setSvcActive(svc.is_active === 1);
    setSvcSelection(svc.requires_wallet_selection === 1);
    setSvcQuickAmts(svc.quick_amounts.join(', '));
    setSvcError('');
    setSvcSuccess(false);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    // Parse quick amounts
    const parsedAmounts = svcQuickAmts
      .split(',')
      .map((item) => parseInt(item.trim(), 10))
      .filter((num) => !isNaN(num) && num > 0);

    setSvcError('');
    try {
      await updateServiceConfig(
        editingService.id,
        svcName.trim(),
        svcColor.trim(),
        svcActive,
        editingService.sort_order,
        parsedAmounts,
        svcSelection
      );
      setSvcSuccess(true);
      setTimeout(() => setEditingService(null), 1000);
    } catch (err: any) {
      setSvcError(err.message || 'Failed to update service.');
    }
  };

  // 3. Wallet Handlers
  const handleOpenEditWallet = (wal: any) => {
    setEditingWallet(wal);
    setWalName(wal.name);
    setWalActive(wal.is_active === 1);
    setWalSuccess(false);
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWallet) return;

    try {
      await editWallet(editingWallet.id, walName.trim(), editingWallet.sort_order, walActive);
      setWalSuccess(true);
      setTimeout(() => setEditingWallet(null), 1000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewWalError('');

    if (!newWalName.trim()) {
      setNewWalError('Please enter a wallet name.');
      return;
    }

    try {
      await addWallet(newWalName.trim());
      setNewWalName('');
      setShowAddWallet(false);
    } catch (err: any) {
      setNewWalError(err.message || 'Failed to add wallet.');
    }
  };

  const handleDeleteWalletClick = async (id: string) => {
    if (confirm('Are you sure you want to delete this wallet? All history links will be broken.')) {
      await deleteWallet(id);
    }
  };

  // 4. Recovery Handlers
  const softDeletedTransactions = transactions.filter((tx) => tx.deleted_at !== null);

  const handleRestore = async (id: string) => {
    await restoreTransaction(id);
  };

  if (!isLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500">Loading settings...</p>
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
        <span className="text-base font-extrabold text-slate-800">Admin Settings</span>
        <div className="w-9 h-9"></div> {/* Balancer spacer */}
      </div>

      {/* Main Container */}
      <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto pb-28">
        
        {/* Sync Connection Banner */}
        <div className="bg-slate-50 rounded-[20px] p-4 border border-slate-150 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Sync Status</span>
              <span className="text-sm font-extrabold text-slate-700 block">
                {syncStatus === 'synced' && 'Synced with Supabase Cloud'}
                {syncStatus === 'pending' && 'Sync Pending (Saving locally)'}
                {syncStatus === 'local_only' && 'Running Locally'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-xs">
            {isOnline ? (
              <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Online</span>
            ) : (
              <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Offline</span>
            )}
          </div>
        </div>

        {/* 1. Shop Profile Accordion */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => toggleSection('profile')}
            className={`w-full p-4 flex justify-between items-center font-bold text-sm bg-slate-50/70 hover:bg-slate-50 transition-all ${
              activeSection === 'profile' ? 'border-b border-slate-100' : ''
            }`}
          >
            <span className="flex items-center gap-2 text-slate-800">
              <Store className="w-4 h-4 text-blue-600" />
              Shop Configuration
            </span>
            <span className="text-xs text-slate-400">{activeSection === 'profile' ? 'Hide' : 'Show'}</span>
          </button>

          {activeSection === 'profile' && (
            <form onSubmit={handleSaveProfile} className="p-4 bg-white space-y-4 animate-slideDown">
              {profileSuccess && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-semibold border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Shop settings saved.</span>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="shopName" className="text-slate-700 font-bold text-xs">Shop Name</Label>
                <Input
                  id="shopName"
                  className="h-10 border-slate-200 text-sm font-semibold rounded-xl"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="shopLogo" className="text-slate-700 font-bold text-xs">Shop Logo Image URL (Optional)</Label>
                <Input
                  id="shopLogo"
                  className="h-10 border-slate-200 text-sm font-semibold rounded-xl"
                  placeholder="https://example.com/logo.png"
                  value={shopLogo}
                  onChange={(e) => setShopLogo(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-10 bg-blue-600 text-white font-bold text-xs rounded-xl">
                Save Shop Config
              </Button>
            </form>
          )}
        </div>

        {/* 2. Manage Services Accordion */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => toggleSection('services')}
            className={`w-full p-4 flex justify-between items-center font-bold text-sm bg-slate-50/70 hover:bg-slate-50 transition-all ${
              activeSection === 'services' ? 'border-b border-slate-100' : ''
            }`}
          >
            <span className="flex items-center gap-2 text-slate-800">
              <Sliders className="w-4 h-4 text-blue-600" />
              Configure Grid Services
            </span>
            <span className="text-xs text-slate-400">{activeSection === 'services' ? 'Hide' : 'Show'}</span>
          </button>

          {activeSection === 'services' && (
            <div className="p-4 bg-white space-y-2 max-h-[300px] overflow-y-auto divide-y divide-slate-100 animate-slideDown">
              {services.map((svc) => (
                <div key={svc.id} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: svc.color || '#1d4ed8' }} />
                    <span className="text-xs font-bold text-slate-800">{svc.name}</span>
                  </div>
                  <button
                    onClick={() => handleOpenEditService(svc)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-250 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200 active:scale-95 transition-all"
                  >
                    Configure
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Manage Wallets Accordion */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => toggleSection('wallets')}
            className={`w-full p-4 flex justify-between items-center font-bold text-sm bg-slate-50/70 hover:bg-slate-50 transition-all ${
              activeSection === 'wallets' ? 'border-b border-slate-100' : ''
            }`}
          >
            <span className="flex items-center gap-2 text-slate-800">
              <Wallet className="w-4 h-4 text-blue-600" />
              Configure Wallet Providers
            </span>
            <span className="text-xs text-slate-400">{activeSection === 'wallets' ? 'Hide' : 'Show'}</span>
          </button>

          {activeSection === 'wallets' && (
            <div className="p-4 bg-white space-y-4 animate-slideDown">
              <div className="space-y-2 divide-y divide-slate-100 max-h-[220px] overflow-y-auto">
                {wallets.map((w) => (
                  <div key={w.id} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                    <span className="text-xs font-bold text-slate-800">{w.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEditWallet(w)}
                        className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200"
                      >
                        Edit
                      </button>
                      {/* Prevent delete of Fino Wallet */}
                      {w.name !== 'Fino Wallet' && (
                        <button
                          onClick={() => handleDeleteWalletClick(w.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded-lg"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!showAddWallet ? (
                <button
                  onClick={() => setShowAddWallet(true)}
                  className="w-full h-9 border border-dashed border-blue-200 text-blue-600 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add Wallet Provider
                </button>
              ) : (
                <form onSubmit={handleCreateWallet} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                  {newWalError && <p className="text-[11px] font-bold text-red-500">{newWalError}</p>}
                  <div className="space-y-1">
                    <Label htmlFor="new-w-name" className="text-slate-700 font-bold text-[10px] uppercase">Provider Name</Label>
                    <Input
                      id="new-w-name"
                      className="h-9 bg-white text-xs font-semibold rounded-lg"
                      placeholder="e.g. Spice Money"
                      value={newWalName}
                      onChange={(e) => setNewWalName(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-grow h-8 bg-blue-600 text-white font-bold text-xs rounded-lg">
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowAddWallet(false);
                        setNewWalError('');
                        setNewWalName('');
                      }}
                      className="flex-grow h-8 bg-slate-200 text-slate-800 font-bold text-xs rounded-lg"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* 4. Recently Deleted Accordion (Transaction Recovery) */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => toggleSection('deleted')}
            className={`w-full p-4 flex justify-between items-center font-bold text-sm bg-slate-50/70 hover:bg-slate-50 transition-all ${
              activeSection === 'deleted' ? 'border-b border-slate-100' : ''
            }`}
          >
            <span className="flex items-center gap-2 text-slate-800">
              <Undo2 className="w-4 h-4 text-blue-600" />
              Recently Deleted Transactions
              {softDeletedTransactions.length > 0 && (
                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 animate-pulse">
                  {softDeletedTransactions.length}
                </span>
              )}
            </span>
            <span className="text-xs text-slate-400">{activeSection === 'deleted' ? 'Hide' : 'Show'}</span>
          </button>

          {activeSection === 'deleted' && (
            <div className="p-4 bg-white space-y-3 max-h-[300px] overflow-y-auto animate-slideDown">
              {softDeletedTransactions.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                  No deleted transactions found.
                </div>
              ) : (
                <div className="space-y-2 divide-y divide-slate-100">
                  {softDeletedTransactions.map((tx) => {
                    const svc = services.find((s) => s.id === tx.service_id);
                    const dateObj = new Date(tx.created_at);
                    const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                    
                    return (
                      <div key={tx.id} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1 pr-3">
                          <span className="text-[9px] font-bold text-slate-400 font-mono block">
                            {tx.transaction_number} | {formattedDate}
                          </span>
                          <span className="text-xs font-extrabold text-slate-700 block truncate">
                            {svc?.name || 'System Transfer'}
                          </span>
                          <span className="text-xs font-black text-slate-900 block mt-0.5">
                            ₹{tx.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRestore(tx.id)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] rounded-lg border border-emerald-200 flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Restore
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. System Info & Logs Panel */}
        <div className="mt-4 p-4 border border-dashed border-slate-200 rounded-2xl space-y-3">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">System Administration</h4>
          <div className="flex gap-2">
            <button
              onClick={() => logout()}
              className="flex-grow h-11 border border-red-200 text-red-600 hover:bg-red-50/20 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out Shop Account
            </button>
          </div>
        </div>
      </div>

      {/* Editing Service Dialog Modal */}
      <Dialog open={editingService !== null} onOpenChange={(open) => !open && setEditingService(null)}>
        <DialogContent className="max-w-xs sm:max-w-sm rounded-[24px] p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-900">
              Configure Service Grid Item
            </DialogTitle>
          </DialogHeader>

          {editingService && (
            <form onSubmit={handleSaveService} className="space-y-4 my-2">
              {svcError && (
                <div className="flex items-center gap-1.5 p-2 bg-red-50 text-red-600 rounded-lg text-[11px] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{svcError}</span>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="s-name" className="text-slate-700 font-bold text-xs">Service Title</Label>
                <Input
                  id="s-name"
                  className="h-10 border-slate-200 text-sm font-semibold rounded-lg"
                  value={svcName}
                  onChange={(e) => setSvcName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="s-color" className="text-slate-700 font-bold text-xs">Brand Hex Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="s-color"
                    className="h-10 border-slate-200 text-sm font-mono font-semibold rounded-lg flex-1"
                    value={svcColor}
                    onChange={(e) => setSvcColor(e.target.value)}
                    required
                  />
                  <div className="w-10 h-10 border border-slate-200 rounded-lg" style={{ backgroundColor: svcColor }} />
                </div>
              </div>

              {/* Toggle Wallet Selection Rule */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex-1 pr-4">
                  <span className="text-xs font-bold text-slate-700 block">Require Wallet Selection</span>
                  <span className="text-[10px] text-slate-400 font-semibold block leading-tight mt-0.5">
                    User must select which wallet to debit on save.
                  </span>
                </div>
                <Switch
                  checked={svcSelection}
                  onCheckedChange={setSvcSelection}
                  disabled={editingService.type === 'balance_enquiry'}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="s-quick" className="text-slate-700 font-bold text-xs">Quick Amounts (comma-separated)</Label>
                <Input
                  id="s-quick"
                  className="h-10 border-slate-200 text-xs font-semibold rounded-lg"
                  placeholder="e.g. 199, 299, 399, 599"
                  value={svcQuickAmts}
                  onChange={(e) => setSvcQuickAmts(e.target.value)}
                  disabled={editingService.type === 'balance_enquiry'}
                />
              </div>

              {/* Toggle is_active */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Service Active Status</span>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Show or hide on home grid.</span>
                </div>
                <Switch checked={svcActive} onCheckedChange={setSvcActive} />
              </div>

              <DialogFooter className="flex gap-2 pt-2">
                <Button type="submit" className="flex-grow h-10 bg-blue-600 text-white font-bold text-xs rounded-lg">
                  Save Service Config
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingService(null)}
                  className="flex-grow h-10 bg-slate-200 text-slate-800 font-bold text-xs rounded-lg hover:bg-slate-350"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}

          {svcSuccess && (
            <div className="absolute inset-0 bg-white/95 rounded-[24px] flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 stroke-[2.5]" />
              <span className="text-sm font-extrabold text-slate-800">Service Config Saved</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Editing Wallet Dialog Modal */}
      <Dialog open={editingWallet !== null} onOpenChange={(open) => !open && setEditingWallet(null)}>
        <DialogContent className="max-w-xs sm:max-w-sm rounded-[24px] p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-900">
              Configure Wallet Account
            </DialogTitle>
          </DialogHeader>

          {editingWallet && (
            <form onSubmit={handleSaveWallet} className="space-y-4 my-2">
              <div className="space-y-1">
                <Label htmlFor="w-name" className="text-slate-700 font-bold text-xs">Wallet Account Name</Label>
                <Input
                  id="w-name"
                  className="h-10 border-slate-200 text-sm font-semibold rounded-lg"
                  value={walName}
                  onChange={(e) => setWalName(e.target.value)}
                  required
                />
              </div>

              {/* Toggle Wallet Active */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Wallet Active Status</span>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Toggle active balance calculation.</span>
                </div>
                <Switch checked={walActive} onCheckedChange={setWalActive} />
              </div>

              <DialogFooter className="flex gap-2 pt-2">
                <Button type="submit" className="flex-grow h-10 bg-blue-600 text-white font-bold text-xs rounded-lg">
                  Save Wallet Config
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingWallet(null)}
                  className="flex-grow h-10 bg-slate-200 text-slate-800 font-bold text-xs rounded-lg hover:bg-slate-350"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}

          {walSuccess && (
            <div className="absolute inset-0 bg-white/95 rounded-[24px] flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 stroke-[2.5]" />
              <span className="text-sm font-extrabold text-slate-800">Wallet Config Saved</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Structural Navigation bounds */}
      <BottomNav />
    </div>
  );
}
