'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!CLIENT_ID) {
      setError('Missing Google client ID configuration.');
    }
  }, []);

  useEffect(() => {
    (window as any).handleGoogleCredential = async (response: { credential?: string }) => {
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
    };
    return () => {
      delete (window as any).handleGoogleCredential;
    };
  }, []);

  return (
    <main className="login">
      <Script src="https://accounts.google.com/gsi/client" async defer />
      <section className="card login-card">
        <div className="label">Sign in required</div>
        <div className="stat">humpline-intelligence</div>
        <p>Use your Google account to access the console.</p>
        {CLIENT_ID ? (
          <div
            id="g_id_onload"
            data-client_id={CLIENT_ID}
            data-callback="handleGoogleCredential"
            data-auto_prompt="false"
          />
        ) : null}
        <div className="g_id_signin" data-type="standard" data-theme="outline" data-size="large" />
        {error ? <p className="footer-note">{error}</p> : null}
      </section>
    </main>
  );
}
