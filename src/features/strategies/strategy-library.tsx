'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import { strategyRepository } from '@/lib/repository/client';
import { Button, Card, Toggle } from '@/components/ui';
import { BlankPage, AsideSection, AsideList, SpecimenTable } from '@/components/ui/blank-page';
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

  if (items.length === 0) {
    return (
      <BlankPage
        headline="No mandate on file."
        lede="A strategy is the written framework you trade or invest by. Vigil holds you to it — every opportunity you check is measured against these rules, and nothing else."
        actions={
          <>
            <Link href="/strategies/new?mode=trading"><Button>New trading strategy →</Button></Link>
            <Link href="/strategies/new?mode=investing"><Button variant="secondary">New investing strategy</Button></Link>
            <Button variant="ghost" onClick={seed}>Load two examples</Button>
          </>
        }
        steps={[
          { title: 'Describe it in words.', body: 'Write the setup the way you would explain it to someone. No forms to fill first.' },
          { title: 'Answer what is unclear.', body: 'Where a threshold or condition is ambiguous, Vigil asks rather than guessing.' },
          { title: 'Mark what is required.', body: 'Required rules can reject an opportunity. The rest only inform the verdict.' },
        ]}
        specimen={{
          title: 'the mandate register',
          body: (
            <SpecimenTable
              template="grid-cols-[30px_minmax(0,1fr)_96px_84px_92px_78px]"
              columns={['No.', 'Mandate', 'Mode', <span key="c" className="block text-right">Conditions</span>,
                <span key="r" className="block text-right">Required</span>, <span key="s" className="block text-right">Status</span>]}
              rows={[
                ['London open liquidity sweep', 'trading', 8, 5, 'active'],
                ['Quality compounders', 'investing', 7, 4, 'active'],
                ['Higher-timeframe breakout', 'trading', 6, 3, 'inactive'],
              ].map(([name, mode, rules, required, status], i) => [
                <span key="n" className="doc">{String(i + 1).padStart(2, '0')}</span>,
                <span key="m" className="ser text-[18px]">{name}</span>,
                <span key="o" className="cap">{mode}</span>,
                <span key="c" className="num block text-right text-[12.5px] text-muted">{String(rules).padStart(2, '0')}</span>,
                <span key="r" className="num block text-right text-[12.5px] text-muted">{String(required).padStart(2, '0')}</span>,
                <span key="s" className={`cap block text-right ${status === 'active' ? '!text-pass' : ''}`}>{status}</span>,
              ])}
            />
          ),
        }}
        aside={
          <>
            <AsideSection label="What a rule can check">
              <AsideList items={[
                { term: 'Numeric', detail: 'A figure against a threshold — risk to reward of at least 1:2.5, P/E under 30.' },
                { term: 'Present or absent', detail: 'Something on the chart — a liquidity sweep, a fair value gap, a break of structure.' },
                { term: 'Time', detail: 'When it may happen — the New York morning session, no trades before a news release.' },
                { term: 'Category', detail: 'Which instruments or sectors qualify at all.' },
              ]} />
            </AsideSection>
            <AsideSection label="Versions">
              <p className="text-muted text-[12px] leading-relaxed">
                Editing a strategy writes a new version. Past checks keep the exact rules they were
                judged against, so the record never changes underneath you.
              </p>
            </AsideSection>
            <AsideSection label="Examples">
              <p className="text-muted text-[12px] leading-relaxed">
                Two worked examples — a New York morning fair value gap setup and a quality growth
                screen — can be loaded, edited, or deleted.
              </p>
              <button type="button" onClick={seed} className="doc hover:!text-ink mt-2.5 cursor-pointer">Load them →</button>
            </AsideSection>
          </>
        }
      />
    );
  }

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
          <p className="text-faint py-14">Nothing matches this filter.</p>
        </Card>
      ) : (
        // A register of mandates, not a wall of cards.
        <div className="border-t border-ink mt-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[720px]">
            <div className="row row-head grid-cols-[30px_minmax(0,1fr)_96px_84px_92px_78px_minmax(0,220px)]">
              <div>No.</div><div>Mandate</div><div>Mode</div>
              <div className="text-right">Conditions</div><div className="text-right">Required</div>
              <div className="text-right">Status</div><div className="text-right">Actions</div>
            </div>
            {visible.map(({ strategy, version }, index) => {
              const mandatory = version.rules.filter((r) => r.mandatory).length;
              return (
                <div key={strategy.id} className="row grid-cols-[30px_minmax(0,1fr)_96px_84px_92px_78px_minmax(0,220px)]">
                  <div className="doc">{String(index + 1).padStart(2, '0')}</div>
                  <div className="min-w-0">
                    <Link href={`/strategies/${strategy.id}`} className="ser text-[18px] hover:underline underline-offset-4">
                      {strategy.name}
                    </Link>
                    {strategy.description && (
                      <div className="text-muted text-[12px] truncate mt-0.5">{strategy.description}</div>
                    )}
                  </div>
                  <div className="cap">{strategy.mode}</div>
                  <div className="num text-right text-[12.5px] text-muted">
                    {String(version.rules.length).padStart(2, '0')}
                  </div>
                  <div className="num text-right text-[12.5px] text-muted">{String(mandatory).padStart(2, '0')}</div>
                  <div className={`cap text-right ${strategy.status === 'active' ? '!text-pass' : ''}`}>
                    {strategy.status}
                  </div>
                  <div className="flex justify-end gap-3 flex-wrap">
                    <Link href={`/strategies/${strategy.id}`} className="cap hover:!text-ink">Edit</Link>
                    <button type="button" className="cap hover:!text-ink cursor-pointer" disabled={busy === strategy.id}
                      onClick={() => act(strategy.id, () => strategyRepository.duplicate(strategy.id))}>Duplicate</button>
                    <button type="button" className="cap hover:!text-ink cursor-pointer" disabled={busy === strategy.id}
                      onClick={() => act(strategy.id, () => strategyRepository.setStatus(strategy.id, strategy.status === 'active' ? 'inactive' : 'active'))}>
                      {strategy.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="cap hover:!text-ink cursor-pointer" disabled={busy === strategy.id}
                      onClick={() => act(strategy.id, () => strategyRepository.setStatus(strategy.id, 'archived'))}>Archive</button>
                    <button type="button" className="cap hover:!text-fail cursor-pointer" disabled={busy === strategy.id}
                      onClick={() => {
                        if (confirm(`Delete "${strategy.name}"? Past analyses keep their saved rule results.`)) {
                          void act(strategy.id, () => strategyRepository.remove(strategy.id));
                        }
                      }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
