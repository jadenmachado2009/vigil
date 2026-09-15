'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import type { AnalysisRecord } from '@/types/analysis';
import { strategyRepository, analysisRepository } from '@/lib/repository/client';
import { useMode, MODE_COPY } from '@/features/mode/mode-context';
import { Button, VerdictPill } from '@/components/ui';
import { Procedure } from '@/components/ui/blank-page';
import { MarketWatch } from './market-watch';

const REGISTER: { verdict: AnalysisRecord['verdict']; label: string; note: string }[] = [
  { verdict: 'QUALIFIED', label: 'Qualified', note: 'Every required rule passed' },
  { verdict: 'WATCH', label: 'Watch', note: 'Nothing broken, not yet confirmed' },
  { verdict: 'REJECTED', label: 'Rejected', note: 'A required rule was broken' },
  { verdict: 'INSUFFICIENT_DATA', label: 'Insufficient data', note: 'Could not be verified' },
];

const TONE: Record<AnalysisRecord['verdict'], string> = {
  QUALIFIED: 'text-pass',
  WATCH: 'text-watch',
  REJECTED: 'text-fail',
  INSUFFICIENT_DATA: 'text-none',
};

const pad = (n: number) => String(n).padStart(2, '0');

export function DashboardOverview() {
  const { mode } = useMode();
  const copy = MODE_COPY[mode];
  const [items, setItems] = useState<StrategyWithVersion[] | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[] | null>(null);

  useEffect(() => {
    void strategyRepository.list().then(setItems);
    void analysisRepository.list().then(setAnalyses);
  }, []);

  // Everything on this screen answers to the mode switch.
  const scoped = (analyses ?? []).filter((a) => a.mode === mode);
  const active = (items ?? []).filter((i) => i.strategy.status === 'active' && i.strategy.mode === mode);
  const count = (v: AnalysisRecord['verdict']) => scoped.filter((a) => a.verdict === v).length;
  const qualified = count('QUALIFIED');
  const inForce = active[0] ?? null;

  return (
    <div className="grid lg:grid-cols-[65fr_35fr] gap-x-16 gap-y-12 items-start">
      <div>
        <div className="ser text-[40px] leading-[1.08] font-light max-w-[18ch]">
          {scoped.length === 0 ? (
            'Nothing under review.'
          ) : (
            <>
              {scoped.length} {copy.subject}.{' '}
              <span className={qualified > 0 ? 'text-pass' : ''}>{qualified} qualified.</span>
            </>
          )}
        </div>
        <p className="text-muted leading-relaxed mt-5 max-w-[52ch]">
          Define the framework you {mode === 'trading' ? 'trade' : 'invest'} by. Every opportunity is
          measured against it.
        </p>

        <div className="flex flex-wrap gap-3 mt-7">
          <Link href="/analyze"><Button>{copy.cta} →</Button></Link>
          <Link href="/strategies"><Button variant="secondary">View strategies</Button></Link>
        </div>

        {/* Status → explanation → count. The figure is the quietest thing in the row. */}
        <div className="border-t border-ink mt-10">
          {REGISTER.map((entry, index) => {
            const n = count(entry.verdict);
            return (
              <div key={entry.verdict} className="row grid-cols-[30px_minmax(0,1fr)_44px] !py-4">
                <div className="doc">{pad(index + 1)}</div>
                <div>
                  {/* Status leads, explanation supports, figure is quietest. */}
                  <div className={`ser text-[19px] leading-none ${n > 0 ? TONE[entry.verdict] : ''}`}>
                    {entry.label}
                  </div>
                  <div className="text-muted text-[12px] mt-1.5">{entry.note}</div>
                </div>
                <div className={`num text-right text-[13px] ${n > 0 ? TONE[entry.verdict] : 'text-dim'}`}>
                  {analyses === null ? '––' : pad(n)}
                </div>
              </div>
            );
          })}
        </div>

        {scoped.length === 0 && (
          <Procedure
            className="mt-12"
            steps={[
              { title: 'Write your rules.', body: `Describe the ${mode === 'trading' ? 'setup you trade' : 'companies you buy'} in plain words. Vigil turns it into rules and asks about anything unclear.` },
              { title: mode === 'trading' ? 'Check a chart.' : 'Check a company.', body: mode === 'trading'
                ? 'Drop a screenshot or say what you see. Each rule is marked pass, fail, pending, or no data.'
                : 'Search a ticker. Fundamentals are measured against each criterion, with a valuation alongside.' },
              { title: 'Record what happened.', body: 'Outcomes go in the journal. Over time, Analytics shows which rules earn their place.' },
            ]}
          />
        )}
      </div>

      {/* A quiet information column rather than empty margin. */}
      <aside className="flex flex-col gap-9">
        <section>
          <div className="doc">Strategy in force</div>
          <div className="border-t border-ink mt-2 pt-3">
            {items === null ? (
              <div className="text-dim text-[12px]">Loading</div>
            ) : inForce ? (
              <Link href={`/strategies/${inForce.strategy.id}`} className="block group">
                <div className="ser text-[19px] group-hover:underline underline-offset-4">
                  {inForce.strategy.name}
                </div>
                <div className="doc mt-2">
                  {pad(inForce.version.rules.length)} {copy.unit} ·{' '}
                  {pad(inForce.version.rules.filter((r) => r.mandatory).length)} required
                </div>
                {active.length > 1 && (
                  <div className="doc mt-1.5">+{active.length - 1} more active</div>
                )}
              </Link>
            ) : (
              <div>
                <div className="text-muted text-[12.5px] leading-relaxed">
                  No {mode} framework defined.
                </div>
                <Link href={`/strategies/new?mode=${mode}`} className="doc hover:text-ink mt-2 inline-block">
                  Define one →
                </Link>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="doc">Recent</div>
          <div className="border-t border-ink mt-2">
            {scoped.length === 0 ? (
              <div className="pt-3">
                <div className="text-muted text-[12.5px] leading-relaxed">
                  Checks you run appear here, newest first, with their verdict.
                </div>
                <Link href="/analyze" className="doc hover:text-ink mt-2 inline-block">{copy.cta} →</Link>
              </div>
            ) : (
              scoped.slice(0, 5).map((a) => (
                <div key={a.id} className="row grid-cols-[minmax(0,1fr)_auto] !py-2.5 gap-3">
                  <div className="min-w-0">
                    <div className="num text-[12.5px] truncate">{a.subject}</div>
                    <div className="doc mt-1 truncate">{a.strategyName}</div>
                  </div>
                  <VerdictPill verdict={a.verdict} />
                </div>
              ))
            )}
          </div>
        </section>

        <MarketWatch />

        <section className="border-t border-rule pt-3">
          <div className="doc">Source</div>
          <div className="text-muted text-[12px] mt-1.5 leading-relaxed">
            Vigil analysis engine · deterministic
          </div>
        </section>
      </aside>
    </div>
  );
}
