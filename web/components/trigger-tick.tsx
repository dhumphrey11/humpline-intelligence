'use client';

import { useState, useTransition } from 'react';

export function TriggerTick() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customTick, setCustomTick] = useState<string>('');

  const runTick = () => {
    startTransition(async () => {
      setStatus(null);
      setError(null);
      const payload = customTick ? { tick_id: customTick } : undefined;
      const response = await fetch('/api/admin/tick/run', {
        method: 'POST',
        headers: payload ? { 'Content-Type': 'application/json' } : undefined,
        body: payload ? JSON.stringify(payload) : undefined
      });
      if (!response.ok) {
        const respBody = await response.json().catch(() => null);
        if (respBody?.missing) {
          setError(`Missing data for: ${respBody.missing.join(', ')}`);
        } else {
          setError(respBody?.error ?? `Failed: ${response.status}`);
        }
        return;
      }
      const respBody = await response.json().catch(() => null);
      setStatus(respBody?.status ?? 'OK');
    });
  };

  return (
    <div className="toggle">
      <div className="input-label">
        <span>Custom tick_id (optional, ISO timestamp)</span>
        <input
          className="input"
          type="text"
          placeholder="e.g. 2026-01-10T15:30:00Z"
          value={customTick}
          onChange={(e) => setCustomTick(e.target.value)}
        />
        <span className="footer-note">Leave blank to use the current 6h boundary; set to now for a manual run.</span>
      </div>
      <button className="btn" onClick={runTick} disabled={pending}>
        {pending ? 'Running tick...' : 'Add Tick (run now)'}
      </button>
      {status ? <p className="footer-note">Result: {status}</p> : null}
      {error ? <p className="footer-note">{error}</p> : null}
    </div>
  );
}
