'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, User, AlertCircle, ShieldAlert } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function LoginPage() {
  const { login, isChecking } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    const success = await login(username, password);
    setLoading(false);

    if (!success) {
      setError('Invalid username or password.');
    }
  };

  if (isChecking) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-6 min-h-screen">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500">Checking session...</p>
      </div>
    );
  }

  const cloudConnected = isSupabaseConfigured();

  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-10 min-h-screen">
      {/* Top Section / Brand */}
      <div className="flex flex-col items-center justify-center mt-12">
        <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
          <svg className="w-12 h-12 fill-white" viewBox="0 0 512 512">
            <path d="M130 90 L170 90 C186.5 90 200 103.5 200 120 C200 136.5 186.5 150 170 150 L130 150 Z" />
            <path d="M130 150 L175 150 C191.5 150 205 163.5 205 180 C205 196.5 191.5 210 175 210 L130 210 Z" />
            <path d="M100 80 L130 80 L130 220 L100 220 Z" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">BHAWANI ENTERPRISES</h1>
        <p className="mt-2 text-sm text-slate-500 font-medium">Digital Register & Shop Ledger</p>
      </div>

      {/* Middle Section / Form */}
      <form onSubmit={handleSubmit} className="flex-grow flex flex-col justify-center max-w-sm w-full mx-auto my-8 gap-5">
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="username" className="text-slate-700 font-semibold text-sm">Username</Label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <User className="w-5 h-5 stroke-[2px]" />
            </span>
            <Input
              id="username"
              type="text"
              placeholder="Enter username"
              className="pl-11 h-13 border-slate-200 focus-visible:ring-blue-600 text-base font-medium rounded-[18px]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-700 font-semibold text-sm">Password</Label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Lock className="w-5 h-5 stroke-[2px]" />
            </span>
            <Input
              id="password"
              type="password"
              placeholder="Enter password"
              className="pl-11 h-13 border-slate-200 focus-visible:ring-blue-600 text-base font-medium rounded-[18px]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-13 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-base shadow-md shadow-blue-100 rounded-[18px] transition-all mt-4"
        >
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </form>

      {/* Bottom Section / Status */}
      <div className="flex flex-col items-center justify-end text-xs font-semibold text-slate-400 gap-1.5">
        <div className="flex items-center gap-1">
          {cloudConnected ? (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>Connected to Cloud Sync</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span>Running in Local Mode (Offline-first)</span>
            </>
          )}
        </div>
        <p>© 2026 Bhawani Enterprises. All rights reserved.</p>
      </div>
    </div>
  );
}
