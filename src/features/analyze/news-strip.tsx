'use client';

import { useEffect, useState } from 'react';

interface Item { headline: string; source: string; url: string; publishedAt: string }
interface Payload { configured: boolean; items: Item[]; source: string | null; error?: string }

/** Headlines with their sources. Nothing summarised, nothing read into a rule. */
export function NewsStrip({ symbol }: { symbol: string }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    setData(null);
    void fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json() as Promise<Payload>)
      .then(setData)
      .catch(() => setData({ configured: false, items: [], source: null }));
  }, [symbol]);

  if (!data) return null;

  return (
    <section className="border-t border-rule pt-3">
      <div className="doc">Recent coverage</div>
      {!data.configured ? (
        <p className="text-muted text-[14px] leading-relaxed mt-2">
          No news source configured. Set <span className="num text-ink">FINNHUB_API_KEY</span> to see recent
          headlines with their sources.
        </p>
      ) : data.items.length === 0 ? (
        <p className="text-muted text-[14px] mt-2">{data.error ?? 'Nothing in the last two weeks.'}</p>
      ) : (
        <>
          <div className="mt-2">
            {data.items.map((item) => (
              <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"
                className="block py-2.5 border-b border-hair last:border-b-0 group">
                <div className="text-[14.5px] leading-snug group-hover:underline underline-offset-4">{item.headline}</div>
                <div className="doc mt-1">
                  {item.source} · {new Date(item.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </div>
              </a>
            ))}
          </div>
          <div className="doc mt-2">Source · {data.source}. Headlines only; nothing here informs a verdict.</div>
        </>
      )}
    </section>
  );
}
