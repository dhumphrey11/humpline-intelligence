'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string>) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gsiReady, setGsiReady] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/auth/config');
        const data = await response.json();
        setClientId(data.clientId || null);
      } catch {
        setClientId(null);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (!clientId) {
      setError('Missing Google client ID configuration.');
      return;
    }
    if (!gsiReady || !buttonRef.current || initializedRef.current) {
      return;
    }
    if (!window.google?.accounts?.id) {
      return;
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (!response?.credential) {
          setError('Login failed. Please try again.');
          return;
        }
        setError(null);
        const result = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: response.credential })
        });
        if (!result.ok) {
          setError('Login failed. Please try again.');
          return;
        }
        window.location.href = '/';
      }
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      width: '280'
    });
    initializedRef.current = true;
  }, [clientId, gsiReady]);

  return (
    <main className="login">
      <Script src="https://accounts.google.com/gsi/client" async defer onLoad={() => setGsiReady(true)} />
      <section className="card login-card">
        <div className="label">Sign in required</div>
        <div className="stat">humpline-intelligence</div>
        <p>Use your Google account to access the console.</p>
        <div className="login-button" ref={buttonRef} />
        {error ? <p className="footer-note">{error}</p> : null}
      </section>
    </main>
  );
}
