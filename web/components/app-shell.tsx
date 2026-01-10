'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Navigation } from './navigation';
import { UtcClock } from './utc-clock';

export function AppShell({ children, email }: { children: ReactNode; email: string }) {
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
        <div>
          <div className="app-title">humpline-intelligence</div>
          <div className="app-subtitle">Paper trading research console</div>
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
      </header>
      <Navigation />
      {children}
      <p className="footer-note">UTC timestamps · Candle close times · Cloud Run MVP</p>
    </main>
  );
}
