'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import type { AnalysisRecord } from '@/types/analysis';
import { strategyRepository, analysisRepository } from '@/lib/repository/client';
import { Button, VerdictPill } from '@/components/ui';

const REGISTER: { verdict: AnalysisRecord['verdict']; label: string; note: string }[] = [
  { verdict: 'QUALIFIED', label: 'Qualified', note: 'Every required rule passed' },
  { verdict: 'WATCH', label: 'Watch', note: 'Nothing broke, not yet confirmed' },
  { verdict: 'REJECTED', label: 'Rejected', note: 'A required rule was broken' },
  { verdict: 'INSUFFICIENT_DATA', label: 'Insufficient data', note: 'Could not be verified — never assumed' },
];

const TONE: Record<AnalysisRecord['verdict'], string> = {
  QUALIFIED: 'text-pass',
  WATCH: 'text-watch',
  REJECTED: 'text-fail',
  INSUFFICIENT_DATA: 'text-none',
};

export function DashboardOverview() {
  const [items, setItems] = useState<StrategyWithVersion[] | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[] | null>(null);

  useEffect(() => {
    void strategyRepository.list().then(setItems);
    void analysisRepository.list().then(setAnalyses);
  }, []);

  const all = analyses ?? [];
  const count = (v: AnalysisRecord['verdict']) => all.filter((a) => a.verdict === v).length;
  const active = (items ?? []).filter((i) => i.strategy.status === 'active');
  const qualified = count('QUALIFIED');

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-14 items-start">
      <div>
        {/* The state of things, as a sentence. */}
        <div className="ser text-[38px] leading-[1.05] text-muted max-w-[20ch]">
          {all.length === 0 ? (
            <>Nothing checked yet. <span className="text-ink">Build a strategy first.</span></>
          ) : qualified > 0 ? (
            <>{all.length} checked. <span className="text-pass">{qualified} qualified.</span></>
          ) : (
            <>{all.length} checked. <span className="text-ink">None qualified.</span></>
          )}
        </div>
        <p className="text-muted text-[13px] leading-relaxed mt-5 max-w-[54ch]">
          {all.length === 0
            ? 'Define the rules you already trade or invest by. Every opportunity you check afterwards is judged against them, not against a fresh opinion.'
            : 'Every rejection is the instrument working. Whether the rules themselves are right is a different question — one the journal and rule attribution will answer.'}
        </p>

        <div className="border-t border-ink mt-9">
          {REGISTER.map((entry, index) => {
            const n = count(entry.verdict);
            return (
              <div key={entry.verdict} className="row grid-cols-[34px_minmax(0,1fr)_110px] !py-4">
                <div className={`num text-[11px] ${n > 0 ? TONE[entry.verdict] : 'text-dim'}`}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div>
                  <div className={`ser text-[17px] ${n > 0 ? TONE[entry.verdict] : ''}`}>{entry.label}</div>
                  <div className="text-muted text-[12px] mt-0.5">{entry.note}</div>
                </div>
                <div className={`num text-right text-[30px] leading-none ${n > 0 ? TONE[entry.verdict] : 'text-dim'}`}>
                  {analyses === null ? '—' : n}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-8">
          <Link href="/analyze"><Button>Check an opportunity</Button></Link>
          <Link href="/strategies"><Button variant="secondary">Strategies ({items === null ? '—' : active.length})</Button></Link>
        </div>
      </div>

      <div>
        <div className="cap">Recent — most recent first</div>
        <div className="border-t border-ink mt-2.5">
          {all.length === 0 ? (
            <div className="text-faint py-8 text-[12.5px] leading-relaxed">
              Nothing yet. Press <span className="kbd">G</span> <span className="kbd">A</span> to check something.
            </div>
          ) : (
            all.slice(0, 7).map((a) => (
              <div key={a.id} className="row grid-cols-[minmax(0,1fr)_52px_auto] !py-3">
                <div className="min-w-0">
                  <div className="num text-[13px] truncate">{a.subject}</div>
                  <div className="cap mt-1">{a.strategyName} v{a.strategyVersion}</div>
                </div>
                <div className="num text-right text-faint text-[12px]">
                  {a.summary.mandatoryPassed}/{a.summary.mandatoryTotal}
                </div>
                <div className="text-right"><VerdictPill verdict={a.verdict} /></div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-rule mt-8 pt-3">
          <div className="cap">Not yet built</div>
          <p className="text-muted text-[12px] leading-relaxed mt-2">
            Outcome tracking, rule attribution and portfolio limits. Until a trade's result is recorded
            against the rules that judged it, this screen can only report what complied — never what
            worked.
          </p>
        </div>
      </div>
    </div>
  );
}
