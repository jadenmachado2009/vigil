'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Portfolio, Position, PortfolioLimits } from '@/lib/portfolio/types';
import { reviewPortfolio, CASH } from '@/lib/portfolio/review';
import { portfolioRepository } from '@/lib/repository/client';
import { Button, Empty } from '@/components/ui';
import { formatRatio } from '@/lib/format';

const SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary', 'Consumer Staples',
  'Industrials', 'Energy', 'Materials', 'Utilities', 'Real Estate', 'Communication Services',
];

const EMPTY: Portfolio = {
  id: 'mine',
  name: 'My portfolio',
  positions: [{ ticker: CASH, weight: 100 }],
  limits: { maxSinglePosition: 20, maxSectorExposure: 50, minCash: 10 },
  updatedAt: '',
};

const pct = (n: number) => `${formatRatio(n, 1)}%`;

function LimitField({ label, value, onChange, hint }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; hint: string;
}) {
  return (
    <label className="field-label block">
      {label}
      <input
        className="field num mt-1.5"
        type="number" step="any" min="0"
        value={value ?? ''}
        placeholder="not set"
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
      <span className="block text-faint font-normal text-[12.5px] mt-1.5 normal-case tracking-normal">{hint}</span>
    </label>
  );
}

export function PortfolioScreen() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    void portfolioRepository.get().then((p) => setPortfolio(p ?? EMPTY));
  }, []);

  const review = useMemo(() => (portfolio ? reviewPortfolio(portfolio) : null), [portfolio]);

  if (!portfolio || !review) return <Empty>Loading…</Empty>;

  const update = (patch: Partial<Portfolio>) => setPortfolio({ ...portfolio, ...patch });
  const setPosition = (index: number, patch: Partial<Position>) =>
    update({ positions: portfolio.positions.map((p, i) => (i === index ? { ...p, ...patch } : p)) });
  const setLimit = (patch: Partial<PortfolioLimits>) => update({ limits: { ...portfolio.limits, ...patch } });

  async function save() {
    if (!portfolio) return;
    setSaving(true);
    try {
      const saved = await portfolioRepository.save({ ...portfolio, updatedAt: new Date().toISOString() });
      setPortfolio(saved);
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  }

  const breaches = review.violations.filter((v) => v.severity === 'breach');
  const notes = review.violations.filter((v) => v.severity === 'note');

  return (
    <div className="grid lg:grid-cols-[65fr_35fr] gap-x-16 gap-y-12 items-start">
      <div>
        {/* The finding first. */}
        <div className={`ser text-[44px] leading-[1.08] font-light max-w-[20ch] ${breaches.length ? 'text-fail' : 'text-muted'}`}>
          {breaches.length === 0
            ? <>Within <span className="text-ink">every limit</span> you set.</>
            : <>{breaches.length === 1 ? 'One limit' : `${breaches.length} limits`} breached.</>}
        </div>

        {review.violations.length > 0 && (
          <div className="border-t border-ink mt-7">
            {breaches.map((v, i) => (
              <div key={`b${i}`} className="row grid-cols-[30px_minmax(0,1fr)_120px_120px] !py-3.5 !items-start">
                <span className="doc text-fail">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className="cap !text-fail">Portfolio rule violation</div>
                  <div className="mt-1 text-[15px]">{v.message}</div>
                </div>
                <div className="text-right"><div className="doc">Limit</div><div className="num text-[15px] mt-1">{v.limit}</div></div>
                <div className="text-right"><div className="doc">Actual</div><div className="num text-[15px] mt-1 text-fail">{v.actual}</div></div>
              </div>
            ))}
            {notes.map((v, i) => (
              <div key={`n${i}`} className="row grid-cols-[30px_minmax(0,1fr)] !py-3 !items-start">
                <span className="doc">–</span>
                <div className="text-muted text-[14.5px]">{v.message}</div>
              </div>
            ))}
          </div>
        )}

        <div className="doc mt-10">Holdings</div>
        <div className="border-t border-ink mt-2">
          <div className="row row-head grid-cols-[minmax(0,1fr)_170px_90px_28px]">
            <span>Ticker</span><span>Sector</span><span className="text-right">Weight</span><span />
          </div>
          {portfolio.positions.map((p, i) => {
            const cash = p.ticker.toUpperCase() === CASH;
            return (
              <div key={i} className="row grid-cols-[minmax(0,1fr)_170px_90px_28px] !py-2">
                <input className="field num !py-1.5 uppercase" value={p.ticker}
                  onChange={(e) => setPosition(i, { ticker: e.target.value })} placeholder="NVDA" />
                <select className="field !py-1.5" value={cash ? '' : p.sector ?? ''} disabled={cash}
                  onChange={(e) => setPosition(i, { sector: e.target.value || undefined })}>
                  <option value="">{cash ? '—' : 'Unknown'}</option>
                  {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="relative">
                  <input className="field num !py-1.5 text-right pr-6" type="number" step="any" min="0" value={p.weight}
                    onChange={(e) => setPosition(i, { weight: Number(e.target.value) })} />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim text-[12.5px]">%</span>
                </div>
                <button type="button" aria-label={`Remove ${p.ticker}`} className="text-dim hover:text-fail cursor-pointer"
                  onClick={() => update({ positions: portfolio.positions.filter((_, j) => j !== i) })}>×</button>
              </div>
            );
          })}
          <div className="row grid-cols-[minmax(0,1fr)_90px_28px] !py-2.5 !border-b-0">
            <button type="button" className="cap text-left hover:!text-ink cursor-pointer"
              onClick={() => update({ positions: [...portfolio.positions, { ticker: '', weight: 0 }] })}>+ Add position</button>
            <span className={`num text-right text-[14.5px] ${Math.abs(review.cashWeight + review.investedWeight - 100) > 0.5 ? 'text-watch' : 'text-muted'}`}>
              {pct(review.cashWeight + review.investedWeight)}
            </span>
            <span />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-6">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save portfolio'}</Button>
          {savedAt && <span className="doc">Saved {savedAt}</span>}
        </div>
      </div>

      <aside className="flex flex-col gap-9">
        <section>
          <div className="doc">Limits</div>
          <div className="border-t border-ink mt-2 pt-4 flex flex-col gap-4">
            <LimitField label="Max single position" value={portfolio.limits.maxSinglePosition}
              onChange={(v) => setLimit({ maxSinglePosition: v })} hint="Largest weight any one holding may have." />
            <LimitField label="Max sector exposure" value={portfolio.limits.maxSectorExposure}
              onChange={(v) => setLimit({ maxSectorExposure: v })} hint="Largest combined weight in one sector." />
            <LimitField label="Minimum cash" value={portfolio.limits.minCash}
              onChange={(v) => setLimit({ minCash: v })} hint="Smallest weight the cash line may have." />
            <div className="grid grid-cols-2 gap-3">
              <LimitField label="Min positions" value={portfolio.limits.minPositions}
                onChange={(v) => setLimit({ minPositions: v })} hint="Excluding cash." />
              <LimitField label="Max positions" value={portfolio.limits.maxPositions}
                onChange={(v) => setLimit({ maxPositions: v })} hint="Excluding cash." />
            </div>
            <p className="text-dim text-[12.5px] leading-snug">A limit left blank is not checked. Nothing is assumed.</p>
          </div>
        </section>

        <section>
          <div className="doc">Exposure by sector</div>
          <div className="border-t border-ink mt-2">
            <div className="row grid-cols-[minmax(0,1fr)_70px] !py-2.5">
              <span className="cap !text-ink">Cash</span>
              <span className="num text-right text-[14.5px]">{pct(review.cashWeight)}</span>
            </div>
            {review.sectors.map((s) => {
              const over = portfolio.limits.maxSectorExposure !== undefined && s.sector !== 'Unknown' && s.weight > portfolio.limits.maxSectorExposure;
              return (
                <div key={s.sector} className="row grid-cols-[minmax(0,1fr)_70px] !py-2.5">
                  <div className="min-w-0">
                    <div className={`cap ${over ? '!text-fail' : '!text-ink'}`}>{s.sector}</div>
                    <div className="doc mt-1 truncate">{s.tickers.join(' · ')}</div>
                  </div>
                  <span className={`num text-right text-[14.5px] ${over ? 'text-fail' : ''}`}>{pct(s.weight)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-rule pt-3">
          <div className="doc">Method</div>
          <p className="text-muted text-[14px] mt-1.5 leading-relaxed">
            Holdings are measured against limits you wrote. A breach reports the limit and the actual
            figure. Vigil does not suggest what to buy or sell.
          </p>
        </section>
      </aside>
    </div>
  );
}
