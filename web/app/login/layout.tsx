import '../globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'humpline-intelligence | Sign in'
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
