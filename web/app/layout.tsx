import './globals.css';
import type { ReactNode } from 'react';
import { getAdminDataOverview, getCurrentUser } from '../lib/api';
import { AppShell } from '../components/app-shell';

export const metadata = {
  title: 'humpline-intelligence',
  description: 'Automated crypto research console'
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const email = user?.email ?? 'guest';
  const dataOverview = await getAdminDataOverview();
  const latestPrices = Array.isArray(dataOverview?.recent_candles)
    ? dataOverview.recent_candles.reduce<Record<string, { ts: string; close: string }>>((acc, row) => {
        const existing = acc[row.symbol];
        if (!existing || new Date(row.ts).getTime() > new Date(existing.ts).getTime()) {
          acc[row.symbol] = { ts: row.ts, close: row.close };
        }
        return acc;
      }, {})
    : {};
  return (
    <html lang="en">
      <body>
        <AppShell email={email} prices={latestPrices}>{children}</AppShell>
      </body>
    </html>
  );
}
