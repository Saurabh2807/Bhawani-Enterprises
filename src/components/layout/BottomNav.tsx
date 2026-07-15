'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, FileText, Wallet, Settings } from 'lucide-react';

export const BottomNav = () => {
  const pathname = usePathname();

  // Hide nav on login page or transaction screens (so user focuses on transaction saving)
  if (pathname === '/login') return null;

  const navItems = [
    { label: 'Home', icon: Home, href: '/' },
    { label: 'Ledger', icon: BookOpen, href: '/ledger' },
    { label: 'Reports', icon: FileText, href: '/reports' },
    { label: 'Wallets', icon: Wallet, href: '/wallets' },
    { label: 'Settings', icon: Settings, href: '/settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] max-w-md mx-auto">
      <nav className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-all ${
                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative p-1">
                <Icon className={`w-[22px] h-[22px] transition-transform ${isActive ? 'scale-110 stroke-[2.5px]' : 'stroke-[2px]'}`} />
              </div>
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
