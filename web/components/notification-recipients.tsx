'use client';

import { useState, useTransition } from 'react';

type Props = {
  initialValue: string;
};

export function NotificationRecipients({ initialValue }: Props) {
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const response = await fetch('/api/admin/settings/notify_to', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: value })
      });
      if (!response.ok) {
        setError('Failed to save recipients');
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div className="toggle">
      <input
        type="text"
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="email1@example.com, email2@example.com"
      />
      <button className="btn" onClick={onSave} disabled={pending}>
        {pending ? 'Saving...' : 'Save'}
      </button>
      {saved ? <p className="footer-note">Saved.</p> : null}
      {error ? <p className="footer-note">{error}</p> : null}
    </div>
  );
}
