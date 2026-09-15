'use client';

import { useEffect, useState } from 'react';

interface Quote { symbol: string; label: string; price: number | null; changePercent: number | null; available: boolean }
interface Payload { configured: boolean; quotes: Quote[]; source: string | null }

const price = (value: number) =>
  value >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  : value >= 10 ? value.toFixed(2)
  : value.toFixed(4);

/**
 * Live quotes, or an honest absence.
 *
 * Every other data source in Vigil has a labelled demo fallback. This one does
 * not: a fabricated price is a checkable claim about the world that looks
 * identical to a real one, and nobody should be able to glance at this strip
 * and act on an invention.
 */
export function MarketWatch() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    void fetch('/api/market')
      .then((r) => r.json() as Promise<Payload>)
      .then(setData)
      .catch(() => setData({ configured: false, quotes: [], source: null }));
  }, []);

  if (!data) return null;

  return (
    <section>
      <div className="doc">Market watch</div>
      <div className="border-t border-ink mt-2">
        {!data.configured ? (
          <p className="text-muted text-[12px] leading-relaxed pt-3">
            No market data source configured. Vigil will not display prices it has not been given —
            set <span className="num text-ink">FINNHUB_API_KEY</span> to enable this.
          </p>
        ) : (
          <>
            {data.quotes.map((quote) => (
              <div key={quote.symbol} className="row grid-cols-[minmax(0,1fr)_auto_52px] !py-2 gap-3">
                <div className={`cap truncate ${quote.available ? '!text-ink' : ''}`}>{quote.label}</div>
                {!quote.available || quote.price === null ? (
                  <div className="doc text-right col-span-2" title={`${data.source ?? 'The provider'} returned no data for this instrument`}>
                    No data from {data.source ?? 'provider'}
                  </div>
                ) : (
                <>
                <div className="num text-[12.5px] text-right">{price(quote.price)}</div>
                <div className={`num text-[11px] text-right ${
                  quote.changePercent === null ? 'text-dim'
                  : quote.changePercent > 0 ? 'text-pass'
                  : quote.changePercent < 0 ? 'text-fail' : 'text-muted'
                }`}>
                  {quote.changePercent === null ? '—'
                    : `${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(1)}%`}
                </div>
                </>
                )}
              </div>
            ))}
            <div className="doc pt-2.5">Source · {data.source}</div>
          </>
        )}
      </div>
    </section>
  );
}
