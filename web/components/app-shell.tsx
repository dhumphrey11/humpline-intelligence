'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Navigation } from './navigation';
import { UtcClock } from './utc-clock';

type Prices = Record<string, { ts: string; close: string }>;

export function AppShell({ children, email, prices }: { children: ReactNode; email: string; prices?: Prices }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const isGuest = !email || email === 'guest';
  const isLogin = pathname.startsWith('/login');

  if (isLogin) {
    return <main className="layout">{children}</main>;
  }

  const handleLogout = () => {
    startTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    });
  };

  return (
    <main className="layout">
      <header className="topbar">
        <div className="topbar-main">
          <div>
            <div className="app-title">humpline-intelligence</div>
            <div className="app-subtitle">Paper trading research console</div>
          </div>
          <div className="pill-row">
            <div className="pill">BTC: {prices?.BTC ? `$${Number(prices.BTC.close).toFixed(2)}` : 'n/a'}</div>
            <div className="pill">ETH: {prices?.ETH ? `$${Number(prices.ETH.close).toFixed(2)}` : 'n/a'}</div>
            <div className="pill">ADA: {prices?.ADA ? `$${Number(prices.ADA.close).toFixed(4)}` : 'n/a'}</div>
          </div>
          <UtcClock />
          <div className="user-chip">
            <span className="user-dot" />
            <span>{email}</span>
            <button
              className="btn-link"
              onClick={handleLogout}
              disabled={pending}
              title={isGuest ? 'Sign in' : 'Sign out'}
            >
              {pending ? '...' : isGuest ? 'Sign in' : 'Sign out'}
            </button>
          </div>
        </div>
        <div className="topbar-nav" style={{ width: '100%' }}>
          <div
            style={{
              background: '#0f172a',
              color: '#e2e8f0',
              borderRadius: '0 0 12px 12px',
              padding: '10px 12px',
              marginTop: '4px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            }}
          >
            <Navigation />
          </div>
        </div>
      </header>
      {children}
      <p className="footer-note">UTC timestamps · Candle close times · Cloud Run MVP</p>
    </main>
  );
}
