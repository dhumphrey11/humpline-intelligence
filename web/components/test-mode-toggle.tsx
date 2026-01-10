'use client';

import { useState, useTransition } from 'react';

type Props = {
  initialEnabled: boolean;
};

export function TestModeToggle({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onToggle = () => {
    startTransition(async () => {
      setError(null);
      const next = !enabled;
      const response = await fetch('/api/admin/settings/test_mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next })
      });
      if (!response.ok) {
        setError('Failed to update test mode');
        return;
      }
      setEnabled(next);
    });
  };

  return (
    <div className="toggle">
      <span className="pill">{enabled ? 'Test mode: ON' : 'Test mode: OFF'}</span>
      <button className="btn" onClick={onToggle} disabled={pending}>
        {pending ? 'Saving...' : enabled ? 'Switch to Prod' : 'Switch to Test'}
      </button>
      {error ? <p className="footer-note">{error}</p> : null}
    </div>
  );
}
