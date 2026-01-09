'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Navigation } from './navigation';

export function AppShell({ children, email }: { children: ReactNode; email: string }) {
  const pathname = usePathname();
  const isLogin = pathname.startsWith('/login');

  if (isLogin) {
    return <main className="layout">{children}</main>;
  }

  return (
    <main className="layout">
      <header className="topbar">
        <div>
          <div className="app-title">humpline-intelligence</div>
          <div className="app-subtitle">Paper trading research console</div>
        </div>
        <div className="user-chip">
          <span className="user-dot" />
          <span>{email}</span>
        </div>
      </header>
      <Navigation />
      {children}
      <p className="footer-note">UTC timestamps · Candle close times · Cloud Run MVP</p>
    </main>
  );
}
