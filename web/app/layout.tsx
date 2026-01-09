import './globals.css';
import type { ReactNode } from 'react';
import { Navigation } from '../components/navigation';

export const metadata = {
  title: 'humpline-intelligence',
  description: 'Automated crypto portfolio research console'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="layout">
          <header className="hero">
            <div className="pill">Paper trading research console</div>
            <h1>humpline-intelligence</h1>
            <p>Signal-driven portfolio allocator for BTC, ETH, ADA. UTC-timed ticks, frozen candles, and transparent model audits.</p>
            <Navigation />
          </header>
          {children}
          <p className="footer-note">UTC timestamps · Candle close times · Cloud Run MVP</p>
        </main>
      </body>
    </html>
  );
}
