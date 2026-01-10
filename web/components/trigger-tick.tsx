'use client';

import { useState, useTransition } from 'react';

export function TriggerTick() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTick = () => {
    startTransition(async () => {
      setStatus(null);
      setError(null);
      const url = apiBase ? `${apiBase}/api/admin/tick/run` : '/api/admin/tick/run';
      const response = await fetch(url, { method: 'POST', credentials: 'include' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? `Failed: ${response.status}`);
        return;
      }
      const body = await response.json().catch(() => null);
      setStatus(body?.status ?? 'OK');
    });
  };

  return (
    <div className="toggle">
      <button className="btn" onClick={runTick} disabled={pending}>
        {pending ? 'Running tick...' : 'Add Tick (run now)'}
      </button>
      {status ? <p className="footer-note">Result: {status}</p> : null}
      {error ? <p className="footer-note">{error}</p> : null}
    </div>
  );
}
