'use client';

import { useEffect, useState } from 'react';

/**
 * The timestamp a research note carries. Rendered after mount because the
 * server and the reader are rarely in the same timezone, and a document that
 * says "as of" should mean the reader's clock.
 */
export function AsOf({ label = 'As of' }: { label?: string }) {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const stamp = () => {
      const d = new Date();
      const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
      const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const zone = new Intl.DateTimeFormat('en', { timeZoneName: 'short' })
        .formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';
      setNow(`${date} · ${time} ${zone}`);
    };
    stamp();
    const timer = setInterval(stamp, 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return null;
  return <span>{label} {now}</span>;
}
