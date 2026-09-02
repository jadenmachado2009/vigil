'use client';

import { useMemo, useState } from 'react';
import type { AnalysisRecord, Outcome } from '@/types/analysis';
import type { TradeStatus, InvestmentStatus } from '@/lib/calculations/outcome';
import { computeRMultiple, classifyOutcome, computeReturnPercent } from '@/lib/calculations/outcome';
import { formatFigure, formatRatio, formatPercent } from '@/lib/format';
import { Button } from '@/components/ui';

const TRADE_STATUSES: { value: TradeStatus; label: string }[] = [
  { value: 'NOT_TAKEN', label: 'Not taken' },
  { value: 'OPEN', label: 'Open' },
  { value: 'WIN', label: 'Win' },
  { value: 'LOSS', label: 'Loss' },
  { value: 'BREAKEVEN', label: 'Breakeven' },
];

const INVESTMENT_STATUSES: { value: InvestmentStatus; label: string }[] = [
  { value: 'NOT_BOUGHT', label: 'Not bought' },
  { value: 'BOUGHT', label: 'Bought' },
  { value: 'HOLDING', label: 'Holding' },
  { value: 'SOLD', label: 'Sold' },
];

function num(value: string): number | null {
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) ? n : null;
}

export function OutcomeForm({
  record, onSave, onClear,
}: {
  record: AnalysisRecord;
  onSave: (outcome: Outcome) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const existing = record.outcome;
  const isTrade = record.mode === 'trading';

  const [status, setStatus] = useState<string>(
    existing?.status ?? (isTrade ? 'NOT_TAKEN' : 'NOT_BOUGHT'),
  );
  const [exit, setExit] = useState(
    existing?.kind === 'trade' && existing.exit !== null ? String(existing.exit) : '',
  );
  const [buy, setBuy] = useState(
    existing?.kind === 'investment' && existing.buyPrice !== null ? String(existing.buyPrice) : '',
  );
  const [sell, setSell] = useState(
    existing?.kind === 'investment' && existing.sellPrice !== null ? String(existing.sellPrice) : '',
  );
  const [thesis, setThesis] = useState(existing?.kind === 'investment' ? existing.thesis ?? '' : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [busy, setBusy] = useState(false);

  /** Levels the analysis was judged on. The outcome is measured against these. */
  const entry = typeof record.observations['entry']?.value === 'number' ? record.observations['entry'].value : null;
  const stop = typeof record.observations['stop']?.value === 'number' ? record.observations['stop'].value : null;
  const direction = record.observations['direction']?.value === 'short' ? 'short' as const
    : record.observations['direction']?.value === 'long' ? 'long' as const : null;

  const rMultiple = useMemo(
    () => computeRMultiple({ entry, stop, exit: num(exit), direction }),
    [entry, stop, exit, direction],
  );
  const returnPercent = useMemo(() => computeReturnPercent(num(buy), num(sell)), [buy, sell]);
  const suggestion = classifyOutcome(rMultiple);

  const needsExit = isTrade && ['WIN', 'LOSS', 'BREAKEVEN'].includes(status);
  const canCompute = entry !== null && stop !== null;

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const outcome: Outcome = isTrade
        ? {
            kind: 'trade',
            status: status as TradeStatus,
            exit: num(exit),
            rMultiple: ['WIN', 'LOSS', 'BREAKEVEN'].includes(status) ? rMultiple : null,
            ...(['WIN', 'LOSS', 'BREAKEVEN'].includes(status) ? { closedAt: now } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
            updatedAt: now,
          }
        : {
            kind: 'investment',
            status: status as InvestmentStatus,
            buyPrice: num(buy),
            sellPrice: num(sell),
            returnPercent: status === 'SOLD' ? returnPercent : null,
            ...(thesis.trim() ? { thesis: thesis.trim() } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
            updatedAt: now,
          };
      await onSave(outcome);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="cap">What happened</div>

      <div className="flex flex-wrap gap-2 mt-3">
        {(isTrade ? TRADE_STATUSES : INVESTMENT_STATUSES).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setStatus(option.value)}
            className={`cap px-3 py-1.5 cursor-pointer border ${
              status === option.value ? 'bg-ink !text-paper border-ink' : 'border-rule hover:border-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isTrade ? (
        <div className="mt-5 grid sm:grid-cols-[160px_minmax(0,1fr)] gap-5 items-start">
          {needsExit && (
            <label className="field-label">
              Exit price
              <input
                className="field num mt-1.5"
                type="number"
                step="any"
                value={exit}
                onChange={(e) => setExit(e.target.value)}
                placeholder={stop !== null ? String(stop) : '0.00'}
              />
            </label>
          )}
          <div className={needsExit ? '' : 'sm:col-span-2'}>
            {needsExit && (
              <div className="border-t border-rule pt-3">
                <div className="cap">R multiple — computed</div>
                {canCompute ? (
                  <>
                    <div className={`num text-[26px] mt-1.5 ${
                      rMultiple === null ? 'text-dim' : rMultiple > 0 ? 'text-pass' : rMultiple < 0 ? 'text-fail' : ''
                    }`}>
                      {rMultiple === null ? '—' : `${rMultiple > 0 ? '+' : ''}${formatRatio(rMultiple)}R`}
                    </div>
                    <p className="text-muted text-[11.5px] mt-1.5 leading-snug">
                      From entry <span className="num">{formatFigure(entry as number)}</span> and stop{' '}
                      <span className="num">{formatFigure(stop as number)}</span>. Never typed in.
                      {suggestion && suggestion !== status && (
                        <> The arithmetic says <button type="button" className="underline underline-offset-2"
                          onClick={() => setStatus(suggestion)}>{suggestion.toLowerCase()}</button>.</>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-muted text-[11.5px] mt-1.5 leading-snug">
                    This analysis has no entry and stop on record, so no R multiple can be derived.
                    It will be logged without one rather than with a guess.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid sm:grid-cols-3 gap-4 items-start">
          <label className="field-label">
            Buy price
            <input className="field num mt-1.5" type="number" step="any" value={buy} onChange={(e) => setBuy(e.target.value)} />
          </label>
          <label className="field-label">
            Sell price
            <input className="field num mt-1.5" type="number" step="any" value={sell} onChange={(e) => setSell(e.target.value)}
              disabled={status !== 'SOLD'} />
          </label>
          <div>
            <div className="cap">Return — computed</div>
            <div className={`num text-[26px] mt-1.5 ${
              returnPercent === null ? 'text-dim' : returnPercent > 0 ? 'text-pass' : returnPercent < 0 ? 'text-fail' : ''
            }`}>
              {returnPercent === null ? '—' : `${returnPercent > 0 ? '+' : ''}${formatPercent(returnPercent)}`}
            </div>
          </div>
        </div>
      )}

      {!isTrade && (
        <label className="field-label block mt-5">
          Investment thesis
          <textarea className="field mt-1.5 min-h-[70px]" value={thesis} onChange={(e) => setThesis(e.target.value)}
            placeholder="Why this, at this price?" />
        </label>
      )}

      <label className="field-label block mt-5">
        Notes
        <textarea className="field mt-1.5 min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="What you would do differently." />
      </label>

      <div className="flex items-center gap-3 mt-5">
        <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Record outcome'}</Button>
        {existing && (
          <Button variant="ghost" onClick={() => void onClear()} disabled={busy}>Clear</Button>
        )}
        <span className="text-dim text-[11px]">The verdict above is never rewritten.</span>
      </div>
    </div>
  );
}
