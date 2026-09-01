'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import { strategyRepository } from '@/lib/repository/local';
import { Button, Card, Toggle } from '@/components/ui';
import { nyAmFvgPreset, qualityGrowthPreset } from './presets';

type Filter = 'active' | 'all' | 'archived';

export function StrategyLibrary() {
  const [items, setItems] = useState<StrategyWithVersion[] | null>(null);
  const [filter, setFilter] = useState<Filter>('active');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => setItems(await strategyRepository.list()), []);
  useEffect(() => { void load(); }, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try { await fn(); await load(); } finally { setBusy(null); }
  }

  async function seed() {
    await strategyRepository.create(nyAmFvgPreset());
    await strategyRepository.create(qualityGrowthPreset());
    await load();
  }

  if (items === null) return <Card><div className="text-muted py-12 text-center">Loading…</div></Card>;

  const visible = items.filter(({ strategy }) =>
    filter === 'all' ? true : filter === 'archived' ? strategy.status === 'archived' : strategy.status === 'active',
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <Toggle
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'All' }, { value: 'archived', label: 'Archived' }]}
        />
        <span className="text-faint text-[12px]">{visible.length} shown</span>
      </div>

      {visible.length === 0 ? (
        <Card>
          <div className="text-center py-14 px-5">
            <p className="text-muted leading-relaxed max-w-[46ch] mx-auto">
              {items.length === 0
                ? 'No strategies yet. Build one from scratch, or start from a worked example and edit it.'
                : 'Nothing matches this filter.'}
            </p>
            {items.length === 0 && (
              <div className="flex gap-3 justify-center mt-5 flex-wrap">
                <Link href="/strategies/new?mode=trading"><Button>Build a trading strategy</Button></Link>
                <Button variant="secondary" onClick={seed}>Load two examples</Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map(({ strategy, version }) => {
            const mandatory = version.rules.filter((r) => r.mandatory).length;
            return (
              <Card key={strategy.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <span className="eyebrow !text-accent">{strategy.mode}</span>
                  {strategy.status !== 'active' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-faint border border-line rounded px-1.5 py-0.5">
                      {strategy.status}
                    </span>
                  )}
                </div>
                <h3 className="text-[19px] font-bold mt-2.5">{strategy.name}</h3>
                {strategy.description && <p className="text-muted mt-1.5 leading-relaxed">{strategy.description}</p>}

                <div className="text-faint text-[12px] mt-3">
                  <span className="num">{version.rules.length}</span> rules · <span className="num">{mandatory}</span> required · <span className="num">v{version.version}</span>
                </div>
                <div className="text-faint text-[12px] mt-1">
                  Created {new Date(strategy.createdAt).toLocaleDateString()}
                </div>

                <div className="text-[12px] text-[#9aa5b1] mt-3 leading-relaxed line-clamp-2">
                  {version.rules.slice(0, 4).map((r) => r.label).join(' · ')}
                  {version.rules.length > 4 ? ' · …' : ''}
                </div>

                <div className="flex flex-wrap gap-2 mt-auto pt-4">
                  <Link href={`/strategies/${strategy.id}`}><Button variant="secondary" className="!py-2 !text-[13px]">Edit</Button></Link>
                  <Button variant="ghost" className="!py-2 !text-[13px]" disabled={busy === strategy.id}
                    onClick={() => act(strategy.id, () => strategyRepository.duplicate(strategy.id))}>Duplicate</Button>
                  <Button variant="ghost" className="!py-2 !text-[13px]" disabled={busy === strategy.id}
                    onClick={() => act(strategy.id, () => strategyRepository.setStatus(strategy.id, strategy.status === 'active' ? 'inactive' : 'active'))}>
                    {strategy.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button variant="ghost" className="!py-2 !text-[13px]" disabled={busy === strategy.id}
                    onClick={() => act(strategy.id, () => strategyRepository.setStatus(strategy.id, 'archived'))}>Archive</Button>
                  <Button variant="danger" className="!py-2 !text-[13px]" disabled={busy === strategy.id}
                    onClick={() => {
                      if (confirm(`Delete "${strategy.name}"? Past analyses keep their saved rule results.`)) {
                        void act(strategy.id, () => strategyRepository.remove(strategy.id));
                      }
                    }}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
