import './globals.css';
import type { ReactNode } from 'react';
import { getCurrentUser } from '../lib/api';
import { AppShell } from '../components/app-shell';

export const metadata = {
  title: 'Welcome to Buy High Sell Low',
  description: 'The crypto trading app designed to beat Trevor\'s sports betting app'
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const email = user?.email ?? 'guest';
  return (
    <html lang="en">
      <body>
        <AppShell email={email}>{children}</AppShell>
      </body>
    </html>
  );
}
