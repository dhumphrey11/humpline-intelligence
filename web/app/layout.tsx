import './globals.css';
import type { ReactNode } from 'react';
import { Navigation } from '../components/navigation';
import { getCurrentUser } from '../lib/api';

export const metadata = {
  title: 'humpline-intelligence',
  description: 'Automated crypto portfolio research console'
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const email = user?.email ?? 'guest';
  return (
    <html lang="en">
      <body>
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
      </body>
    </html>
  );
}
