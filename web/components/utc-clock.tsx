'use client';

import { useEffect, useState } from 'react';
import { formatUtc } from '../lib/format';

export function UtcClock() {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="pill">{formatUtc(now)}</span>;
}
