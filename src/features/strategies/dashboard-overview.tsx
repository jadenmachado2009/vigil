'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import { strategyRepository } from '@/lib/repository/local';
import { Button, Card, SectionHead } from '@/components/ui';

function Stat({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Card className="p-[18px]">
      <span className="block text-[#7f8b98]">{label}</span>
      <strong className="block text-[30px] my-2 font-bold tracking-tight">{value}</strong>
      <small className="block text-[#7f8b98]">{hint}</small>
    </Card>
  );
}

export function DashboardOverview() {
  const [items, setItems] = useState<StrategyWithVersion[] | null>(null);
  useEffect(() => { void strategyRepository.list().then(setItems); }, []);

  const active = (items ?? []).filter((i) => i.strategy.status === 'active');
  const trading = active.filter((i) => i.strategy.mode === 'trading').length;
  const investing = active.filter((i) => i.strategy.mode === 'investing').length;

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
        <Stat label="Checked" value={0} hint="Opportunities" />
        <Stat label="Qualified" value={0} hint="All rules passed" />
        <Stat label="Watch" value={0} hint="Not yet confirmed" />
        <Stat label="Rejected" value={0} hint="Rule violations" />
      </div>

      <SectionHead title="Recent analyses" />
      <Card>
        <div className="text-muted text-center py-14 px-5 leading-relaxed max-w-[52ch] mx-auto">
          The opportunity checker arrives in the next phase. Build the strategy you want to check
          against first — the rules are what the checker reports on.
          <div className="mt-5">
            <Link href="/strategies"><Button variant="secondary">Go to strategies</Button></Link>
          </div>
        </div>
      </Card>
    </>
  );
}
