'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import type { AnalysisRecord } from '@/types/analysis';
import { strategyRepository, analysisRepository } from '@/lib/repository/client';
import { Card, SectionHead, VerdictPill, Empty } from '@/components/ui';

/** Figure first, label under it. No supporting sentence. */
function Stat({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="px-3 py-2.5 border-r border-line last:border-r-0">
      <div className={`num text-[22px] font-medium leading-none ${tone}`}>{value}</div>
      <div className="label mt-2">{label}</div>
    </div>
  );
}

export function DashboardOverview() {
  const [items, setItems] = useState<StrategyWithVersion[] | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[] | null>(null);

  useEffect(() => {
    void strategyRepository.list().then(setItems);
    void analysisRepository.list().then(setAnalyses);
  }, []);

  const active = (items ?? []).filter((i) => i.strategy.status === 'active');
  const all = analyses ?? [];
  const count = (verdict: AnalysisRecord['verdict']) => all.filter((a) => a.verdict === verdict).length;
  const dash = (n: number) => (analyses === null ? '—' : n);

  return (
    <>
      <Card className="grid grid-cols-3 lg:grid-cols-6 divide-line">
        <Stat label="Trading" value={items === null ? '—' : active.filter((i) => i.strategy.mode === 'trading').length} />
        <Stat label="Investing" value={items === null ? '—' : active.filter((i) => i.strategy.mode === 'investing').length} />
        <Stat label="Checked" value={dash(all.length)} />
        <Stat label="Qualified" value={dash(count('QUALIFIED'))} tone={count('QUALIFIED') ? 'text-pass' : ''} />
        <Stat label="Watch" value={dash(count('WATCH'))} tone={count('WATCH') ? 'text-watch' : ''} />
        <Stat label="Rejected" value={dash(count('REJECTED'))} tone={count('REJECTED') ? 'text-fail' : ''} />
      </Card>

      <SectionHead
        title="Recent"
        action={all.length > 0 ? <Link href="/journal" className="text-[12px] text-faint hover:text-ink">Journal →</Link> : undefined}
      />
      <Card className="overflow-x-auto">
        {all.length === 0 ? (
          <Empty>
            Nothing checked yet.{' '}
            <Link href="/analyze" className="text-ink underline underline-offset-4">Check an opportunity</Link>
            {' '}or press <span className="kbd">g</span> <span className="kbd">a</span>.
          </Empty>
        ) : (
          <div className="min-w-[640px]">
            <div className="row row-head grid-cols-[1fr_1.2fr_130px_60px_110px]">
              <div>Subject</div><div>Strategy</div><div>Checked</div><div className="text-right">Rules</div><div className="text-right">Verdict</div>
            </div>
            {all.slice(0, 8).map((a) => (
              <div key={a.id} className="row grid-cols-[1fr_1.2fr_130px_60px_110px]">
                <div className="num truncate">{a.subject}</div>
                <div className="text-muted truncate">{a.strategyName} <span className="num text-dim text-[11px]">v{a.strategyVersion}</span></div>
                <div className="num text-[12px] text-faint">{new Date(a.createdAt).toLocaleDateString()}</div>
                <div className="num text-right text-muted">{a.summary.mandatoryPassed}/{a.summary.mandatoryTotal}</div>
                <div className="text-right"><VerdictPill verdict={a.verdict} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
