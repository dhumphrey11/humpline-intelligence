'use client';

import { useState, useTransition } from 'react';

type Props = {
  initialValue: string[];
};

export function NotificationRecipients({ initialValue }: Props) {
  const [list, setList] = useState<string[]>(initialValue ?? []);
  const [input, setInput] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const persist = (emails: string[]) => {
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const response = await fetch('/api/admin/settings/notify_to', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
      });
      if (!response.ok) {
        setError('Failed to save recipients');
        return;
      }
      setSaved(true);
    });
  };

  const addEmail = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) {
      setInput('');
      return;
    }
    const next = [...list, trimmed];
    setList(next);
    setInput('');
    persist(next);
  };

  const removeEmail = (email: string) => {
    const next = list.filter((e) => e !== email);
    setList(next);
    persist(next);
  };

  return (
    <div className="toggle">
      <div className="pill-list">
        {list.map((email) => (
          <span className="pill" key={email}>
            {email}
            <button className="pill-close" onClick={() => removeEmail(email)} aria-label={`Remove ${email}`}>
              ×
            </button>
          </span>
        ))}
        {list.length === 0 ? <p className="footer-note">No recipients set.</p> : null}
      </div>
      <div className="toggle">
        <input
          type="text"
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="email@example.com"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addEmail();
            }
          }}
        />
        <button className="btn" onClick={addEmail} disabled={pending}>
          Add
        </button>
      </div>
      {saved ? <p className="footer-note">Saved automatically.</p> : null}
      {error ? <p className="footer-note">{error}</p> : null}
    </div>
  );
}
