'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AnalysisRecord } from '@/types/analysis';
import { analysisRepository } from '@/lib/repository/client';
import { computeTradeStatistics, computeInvestmentStatistics, byStrategy } from '@/lib/analytics/statistics';
import { computeRuleAttribution, MIN_ARM } from '@/lib/analytics/attribution';
import { formatRatio, formatPercent } from '@/lib/format';
import { Button, Empty } from '@/components/ui';
import { BlankPage, AsideSection, AsideList } from '@/components/ui/blank-page';

const r = (value: number | null) =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${formatRatio(value)}R`;
const pct = (value: number | null) => (value === null ? '—' : formatPercent(value, 0));

function tone(value: number | null): string {
  if (value === null) return 'text-dim';
  return value > 0 ? 'text-pass' : value < 0 ? 'text-fail' : '';
}

function Measure({ label, value, note, className = '' }: {
  label: string; value: string; note?: string; className?: string;
}) {
  return (
    <div>
      <div className="cap">{label}</div>
      <div className={`num text-[26px] mt-1.5 leading-none ${className}`}>{value}</div>
      {note && <div className="text-dim text-[11px] mt-1.5">{note}</div>}
    </div>
  );
}

export function Analytics() {
  const [records, setRecords] = useState<AnalysisRecord[] | null>(null);
  useEffect(() => { void analysisRepository.list().then(setRecords); }, []);

  const all = records ?? [];
  const stats = useMemo(() => computeTradeStatistics(all), [all]);
  const investments = useMemo(() => computeInvestmentStatistics(all), [all]);
  const strategies = useMemo(() => byStrategy(all), [all]);
  const attribution = useMemo(() => computeRuleAttribution(all), [all]);

  if (records === null) return <Empty>Loading…</Empty>;

  if (stats.trades === 0) {
    return (
      <BlankPage
        headline="Nothing has closed yet."
        lede="Analytics reads the outcomes you record in the journal. It reports what your trades did — and, once there is enough of a record, how they did when each of your rules held against when it did not."
        actions={
          <>
            <Link href="/journal"><Button>Open the journal →</Button></Link>
            <Link href="/analyze"><Button variant="secondary">Analyze opportunity</Button></Link>
          </>
        }
        steps={[
          { title: 'Check opportunities.', body: 'Each check is logged in the journal with its verdict and rule findings.' },
          { title: 'Close them out.', body: 'Record a win, loss, or breakeven with your levels. Open and untaken trades are counted separately.' },
          { title: 'Read the record.', body: `Figures appear from the first closed trade, and are flagged as too small to trust until there are ${stats.sampleShortfall}.` },
        ]}
        after={
          <div className="mt-12">
            <div className="doc">Measures — awaiting closed trades</div>
            <div className="border-t border-ink mt-2 pt-4 grid grid-cols-2 md:grid-cols-4 gap-7">
              <Measure label="Win rate" value="—" className="text-dim" note="Wins ÷ closed trades" />
              <Measure label="Expectancy" value="—" className="text-dim" note="Mean R per trade" />
              <Measure label="Profit factor" value="—" className="text-dim" note="Gross won ÷ gross lost" />
              <Measure label="Max drawdown" value="—" className="text-dim" note="Deepest peak to trough" />
            </div>
          </div>
        }
        aside={
          <>
            <AsideSection label="Thresholds">
              <AsideList items={[
                { term: `${stats.sampleShortfall} closed trades`, detail: 'Below this, every figure carries a “too small to read” warning.' },
                { term: `${MIN_ARM} on each side`, detail: 'A rule is only compared when it held on at least this many trades and was absent on as many.' },
                { term: 'Unverified is excluded', detail: 'A trade whose condition could not be confirmed counts on neither side.' },
              ]} />
            </AsideSection>
            <AsideSection label="Rule performance">
              <p className="text-muted text-[12px] leading-relaxed">
                The point of the journal. For every rule: how trades went when it held, against when
                it did not. It describes what happened alongside a condition — it does not prove the
                condition caused it.
              </p>
            </AsideSection>
          </>
        }
      />
    );
  }

  return (
    <>
      {/* The state of the record, stated plainly. */}
      <div className="ser text-[38px] leading-[1.05] text-muted max-w-[24ch]">
        {stats.trades} closed.{' '}
        <span className={tone(stats.totalR)}>{r(stats.totalR)} settled.</span>
      </div>

      {!stats.sufficient && (
        <p className="text-muted text-[13px] leading-relaxed mt-5 max-w-[62ch] border-l-2 border-watch pl-4">
          <span className="cap !text-watch">Too small to read</span><br />
          These figures are arithmetically correct but statistically meaningless at{' '}
          <span className="num">{stats.trades}</span> trades. {stats.sampleShortfall} more closed
          trades before a win rate or expectancy here means anything.
        </p>
      )}

      <div className="border-t border-ink mt-8 pt-4 grid grid-cols-2 md:grid-cols-4 gap-7">
        <Measure label="Win rate" value={pct(stats.winRate)} note={`${stats.wins}W · ${stats.losses}L · ${stats.breakevens}BE`} />
        <Measure label="Expectancy" value={r(stats.expectancy)} className={tone(stats.expectancy)} note="Mean R per trade" />
        <Measure label="Profit factor" value={stats.profitFactor === null ? '—' : formatRatio(stats.profitFactor)}
          note={stats.profitFactor === null ? 'Nothing lost yet' : 'Gross won ÷ gross lost'} />
        <Measure label="Max drawdown" value={stats.maxDrawdown === 0 ? '—' : `−${formatRatio(stats.maxDrawdown)}R`}
          className={stats.maxDrawdown > 0 ? 'text-fail' : 'text-dim'} note="Deepest peak to trough" />
        <Measure label="Average winner" value={r(stats.averageWinner)} className={tone(stats.averageWinner)} />
        <Measure label="Average loser" value={r(stats.averageLoser)} className={tone(stats.averageLoser)} />
        <Measure label="Largest winner" value={r(stats.largestWinner)} className={tone(stats.largestWinner)} />
        <Measure label="Not taken" value={String(stats.notTaken)} note={`${stats.open} still open`} />
      </div>

      {/* Rule attribution — the reason the journal is worth filling in. */}
      <div className="mt-14">
        <div className="doc">Rule performance — historical observation</div>
        <p className="text-muted text-[12.5px] leading-relaxed mt-2 max-w-[70ch]">
          How closed trades performed when each condition held, against how they performed when it
          did not. A trade whose condition could not be verified is excluded from both sides rather
          than counted as absent. <span className="text-ink">This describes what happened alongside a
          condition. It does not establish that the condition caused it.</span>
        </p>

        <div className="border-t border-ink mt-4">
          {attribution.length === 0 && <Empty>No closed trades carry rule findings yet.</Empty>}

          {attribution.map((entry, index) => (
            <div key={entry.metric} className="border-b border-hair py-5">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div className="flex items-baseline gap-4">
                  <span className="num text-[11px] text-dim">{String(index + 1).padStart(2, '0')}</span>
                  <span className="ser text-[17px]">{entry.label}</span>
                </div>
                {entry.comparable ? (
                  <span className={`num text-[15px] ${tone(entry.expectancyDelta)}`}>
                    {r(entry.expectancyDelta)} difference
                  </span>
                ) : (
                  <span className="cap">Not enough to compare</span>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-x-10 gap-y-3 mt-3 pl-0 sm:pl-[50px]">
                <div className="grid grid-cols-[minmax(0,1fr)_46px_46px_60px] sm:grid-cols-[minmax(0,1fr)_60px_54px_66px] gap-2 sm:gap-3 items-baseline">
                  <span className="cap">Condition held</span>
                  <span className="num text-right text-[13px]">{entry.present.trades}</span>
                  <span className="num text-right text-[13px] text-faint">{pct(entry.present.winRate)}</span>
                  <span className={`num text-right text-[13px] ${tone(entry.present.expectancy)}`}>{r(entry.present.expectancy)}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_46px_46px_60px] sm:grid-cols-[minmax(0,1fr)_60px_54px_66px] gap-2 sm:gap-3 items-baseline">
                  <span className="cap">Condition absent</span>
                  <span className="num text-right text-[13px]">{entry.absent.trades}</span>
                  <span className="num text-right text-[13px] text-faint">{pct(entry.absent.winRate)}</span>
                  <span className={`num text-right text-[13px] ${tone(entry.absent.expectancy)}`}>{r(entry.absent.expectancy)}</span>
                </div>
              </div>

              <div className="text-dim text-[11px] mt-2.5 sm:pl-[50px]">
                Trades · win rate · expectancy
                {entry.unverified > 0 && (
                  <> · <span className="text-watch">{entry.unverified} excluded — could not be verified</span></>
                )}
                {!entry.comparable && <> · needs {MIN_ARM} on each side</>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {strategies.length > 1 && (
        <div className="mt-14">
          <div className="doc">By strategy</div>
          <div className="border-t border-ink mt-2.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="min-w-[520px]">
            <div className="row row-head grid-cols-[minmax(0,1fr)_70px_70px_80px_80px]">
              <div>Strategy</div><div className="text-right">Trades</div><div className="text-right">Win</div>
              <div className="text-right">Expectancy</div><div className="text-right">Total</div>
            </div>
            {strategies.map((entry) => (
              <div key={entry.name} className="row grid-cols-[minmax(0,1fr)_70px_70px_80px_80px]">
                <div className="ser text-[15px] truncate">{entry.name}</div>
                <div className="num text-right">{entry.stats.trades}</div>
                <div className="num text-right text-faint">{pct(entry.stats.winRate)}</div>
                <div className={`num text-right ${tone(entry.stats.expectancy)}`}>{r(entry.stats.expectancy)}</div>
                <div className={`num text-right ${tone(entry.stats.totalR)}`}>{r(entry.stats.totalR)}</div>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}

      {investments.analysed > 0 && (
        <div className="mt-14">
          <div className="doc">Investments</div>
          <div className="border-t border-ink mt-2.5 pt-4 grid grid-cols-2 md:grid-cols-4 gap-7">
            <Measure label="Analysed" value={String(investments.analysed)} />
            <Measure label="Bought / holding" value={`${investments.bought + investments.holding}`} note={`${investments.notBought} passed on`} />
            <Measure label="Average return" value={investments.averageReturn === null ? '—' : formatPercent(investments.averageReturn)}
              className={tone(investments.averageReturn)} note={`${investments.sold} sold`} />
            <Measure label="Best / worst" value={
              investments.bestReturn === null ? '—' : `${formatPercent(investments.bestReturn, 0)} / ${formatPercent(investments.worstReturn as number, 0)}`
            } />
          </div>
        </div>
      )}

      <p className="text-dim text-[11px] mt-14 leading-relaxed max-w-[70ch]">
        Every figure is derived from outcomes you recorded, over {stats.trades} closed{' '}
        {stats.trades === 1 ? 'trade' : 'trades'}. Compliance and profitability are different
        questions: a perfectly followed strategy can still lose money, and a broken rule can still
        precede a winning trade. Past results describe the past only.
      </p>
    </>
  );
}
