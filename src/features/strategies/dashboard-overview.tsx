'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import type { AnalysisRecord } from '@/types/analysis';
import { strategyRepository } from '@/lib/repository/local';
import { analysisRepository } from '@/lib/repository/analyses';
import { Button, Card, SectionHead, VerdictPill } from '@/components/ui';

function Stat({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Card className="p-[18px]">
      <span className="block text-[#7f8b98]">{label}</span>
      <strong className="num block text-[30px] my-2 font-bold tracking-tight">{value}</strong>
      <small className="block text-[#7f8b98]">{hint}</small>
    </Card>
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
  const trading = active.filter((i) => i.strategy.mode === 'trading').length;
  const investing = active.filter((i) => i.strategy.mode === 'investing').length;
  const all = analyses ?? [];
  const count = (verdict: AnalysisRecord['verdict']) => all.filter((a) => a.verdict === verdict).length;
  const recent = all.slice(0, 6);

  return (
    <>
      <Card className="p-7 sm:p-9 overflow-hidden relative">
        <span className="inline-block text-[10px] font-black tracking-[1.7px] uppercase text-[#0a0c0d] bg-accent rounded-full px-3 py-1.5">
          Your rules. Your decisions.
        </span>
        <h2 className="text-[30px] sm:text-[38px] font-bold tracking-[-1.4px] leading-[1.1] mt-5">
          Trade your strategy.<br />Not your emotions.
        </h2>
        <p className="text-muted mt-4 max-w-[56ch] leading-relaxed">
          Define your trading or investing rules once. StrategyAI checks opportunities against those
          rules instead of forming a new opinion every time.
        </p>
        <div className="flex gap-3 mt-6 flex-wrap">
          <Link href="/analyze"><Button>Check an opportunity</Button></Link>
          <Link href="/strategies"><Button variant="secondary">Build a strategy</Button></Link>
        </div>
      </Card>

      <SectionHead title="Overview" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Trading" value={items === null ? '—' : trading} hint="Active strategies" />
        <Stat label="Investing" value={items === null ? '—' : investing} hint="Active strategies" />
        <Stat label="Checked" value={analyses === null ? '—' : all.length} hint="Opportunities" />
        <Stat label="Qualified" value={analyses === null ? '—' : count('QUALIFIED')} hint="All rules passed" />
        <Stat label="Watch" value={analyses === null ? '—' : count('WATCH')} hint="Not yet confirmed" />
        <Stat label="Rejected" value={analyses === null ? '—' : count('REJECTED')} hint="Rule violations" />
      </div>

      <SectionHead title="Recent analyses" />
      <Card className="overflow-x-auto">
        {recent.length === 0 ? (
          <div className="text-muted text-center py-14 px-5 leading-relaxed max-w-[52ch] mx-auto">
            Nothing checked yet. Run a setup against one of your strategies.
            <div className="mt-5">
              <Link href="/analyze"><Button variant="secondary">Check an opportunity</Button></Link>
            </div>
          </div>
        ) : (
          <div className="min-w-[620px]">
            <div className="data-row data-head grid-cols-[1.3fr_1.2fr_1fr_.7fr_auto]">
              <div>Opportunity</div><div>Strategy</div><div>Date</div><div>Rules</div><div>Verdict</div>
            </div>
            {recent.map((a) => (
              <div key={a.id} className="data-row grid-cols-[1.3fr_1.2fr_1fr_.7fr_auto]">
                <div className="font-bold truncate">{a.subject}</div>
                <div className="text-muted truncate">{a.strategyName}</div>
                <div className="num text-muted text-[13px]">{new Date(a.createdAt).toLocaleDateString()}</div>
                <div className="num text-muted text-[13px]">{a.summary.mandatoryPassed}/{a.summary.mandatoryTotal}</div>
                <VerdictPill verdict={a.verdict} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
