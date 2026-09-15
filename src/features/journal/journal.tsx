'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AnalysisRecord, Outcome } from '@/types/analysis';
import { analysisRepository } from '@/lib/repository/client';
import { isClosed, wasTaken } from '@/lib/calculations/outcome';
import { useMode } from '@/features/mode/mode-context';
import { formatRatio, formatFigure } from '@/lib/format';
import { Button, VerdictPill, Empty } from '@/components/ui';
import { RuleTable } from '@/components/ui/rule-table';
import { BlankPage, AsideSection, AsideList, SpecimenTable } from '@/components/ui/blank-page';
import { OutcomeForm } from './outcome-form';

type Filter = 'all' | 'trading' | 'investing' | 'pending';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Needs outcome' },
  { value: 'trading', label: 'Trading' },
  { value: 'investing', label: 'Investing' },
];

const OUTCOME_TONE: Record<string, string> = {
  WIN: 'text-pass', LOSS: 'text-fail', BREAKEVEN: 'text-muted',
  OPEN: 'text-watch', NOT_TAKEN: 'text-dim',
  SOLD: 'text-pass', HOLDING: 'text-watch', BOUGHT: 'text-watch', NOT_BOUGHT: 'text-dim',
};

function outcomeLabel(outcome: Outcome | undefined): string {
  if (!outcome) return 'Not recorded';
  return outcome.status.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/** A figure the analysis actually observed, or null. Never inferred. */
function observed(record: AnalysisRecord, metric: string): number | null {
  const value = record.observations[metric]?.value;
  return typeof value === 'number' ? value : null;
}

export function Journal() {
  const { mode } = useMode();
  const [records, setRecords] = useState<AnalysisRecord[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => setRecords(await analysisRepository.list()), []);
  useEffect(() => { void load(); }, [load]);

  const all = records ?? [];
  const isTrading = mode === 'trading';
  const COLUMNS = 'grid-cols-[62px_minmax(0,1fr)_150px_110px_86px_86px_92px_24px]';

  /**
   * Settled performance. A sum, not a statistic — only closed trades with a
   * derived R multiple count, so an open position cannot flatter the total.
   */
  const settled = useMemo(() => {
    const closed = all.filter(
      (r) => r.outcome?.kind === 'trade' && isClosed(r.outcome.status) && typeof r.outcome.rMultiple === 'number',
    );
    const totalR = closed.reduce((sum, r) => sum + ((r.outcome as { rMultiple: number }).rMultiple), 0);
    const taken = all.filter((r) => r.outcome?.kind === 'trade' && wasTaken(r.outcome.status)).length;
    const pending = all.filter((r) => !r.outcome).length;
    return { closedCount: closed.length, totalR, taken, pending };
  }, [all]);

  const visible = all.filter((r) =>
    filter === 'all' ? true
    : filter === 'pending' ? !r.outcome
    : r.mode === filter,
  );

  async function setOutcome(id: string, outcome: Outcome | null) {
    await analysisRepository.setOutcome(id, outcome);
    await load();
  }

  if (records === null) return <Empty>Loading…</Empty>;

  if (all.length === 0) {
    return (
      <BlankPage
        headline="The ledger is open. Nothing entered."
        lede="The journal fills itself. Every opportunity you check is recorded here with the verdict and the rule findings behind it — you add what happened afterwards."
        actions={
          <>
            <Link href="/analyze"><Button>{isTrading ? 'Analyze opportunity' : 'Analyze company'} →</Button></Link>
            <Link href="/strategies"><Button variant="secondary">View strategies</Button></Link>
          </>
        }
        steps={[
          { title: 'Check an opportunity.', body: 'Run a chart or a company against a strategy. The verdict is written here automatically.' },
          { title: 'Record the outcome.', body: isTrading
            ? 'Win, loss, breakeven, still open, or not taken. The R multiple is worked out from your levels.'
            : 'Bought, holding, sold, or passed on — with the return when there is one.' },
          { title: 'Let it accumulate.', body: 'Once outcomes are recorded, Analytics can show which of your rules actually precede results.' },
        ]}
        specimen={{
          title: 'a filled ledger',
          body: (
            <SpecimenTable
              minWidth={700}
              template="grid-cols-[62px_minmax(0,1fr)_150px_110px_86px_92px]"
              columns={['Date', 'Asset', 'Strategy', <span key="v" className="block text-right">Verdict</span>,
                <span key="r" className="block text-right">RR</span>, <span key="o" className="block text-right">Outcome</span>]}
              rows={([
                ['12 SEP', 'EUR/USD', 'London open sweep', 'QUALIFIED', '2.8x', '+2.6R', 'text-pass'],
                ['11 SEP', 'NAS100', 'London open sweep', 'REJECTED', '1.4x', 'Not taken', 'text-dim'],
                ['09 SEP', 'XAU/USD', 'London open sweep', 'WATCH', '3.1x', 'Open', 'text-watch'],
                ['05 SEP', 'GBP/JPY', 'London open sweep', 'QUALIFIED', '2.5x', '−1R', 'text-fail'],
              ] as const).map(([date, asset, strategy, verdict, rr, outcome, tone]) => [
                <span key="d" className="num text-[11.5px] text-faint">{date}</span>,
                <span key="a" className="ser text-[16px]">{asset}</span>,
                <span key="s" className="text-muted text-[12px]">{strategy}</span>,
                <span key="v" className="block text-right"><VerdictPill verdict={verdict} /></span>,
                <span key="r" className="num block text-right text-[12.5px] text-muted">{rr}</span>,
                <span key="o" className={`cap block text-right ${tone}`}>{outcome}</span>,
              ])}
            />
          ),
        }}
        aside={
          <>
            <AsideSection label="Each entry keeps">
              <AsideList items={[
                { term: 'The verdict', detail: 'Qualified, watch, rejected, or insufficient data — as it stood when you checked.' },
                { term: 'The rules as judged', detail: 'Every rule, what was required, what was observed, and the finding.' },
                { term: 'The strategy version', detail: 'Later edits to a strategy never rewrite an old entry.' },
                { term: 'The chart', detail: 'A reduced copy of any screenshot you analysed.' },
              ]} />
            </AsideSection>
            <AsideSection label="Why outcomes matter">
              <p className="text-muted text-[12px] leading-relaxed">
                A verdict says whether an opportunity followed your rules. Only the outcome says
                whether following them paid. Without outcomes, nothing can be measured.
              </p>
            </AsideSection>
          </>
        }
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-ink pt-3">
        <div>
          <div className="cap">Checked</div>
          <div className="num text-[28px] mt-1.5 leading-none">{all.length}</div>
        </div>
        <div>
          <div className="cap">Taken</div>
          <div className="num text-[28px] mt-1.5 leading-none">{settled.taken}</div>
        </div>
        <div>
          <div className="cap">Closed</div>
          <div className="num text-[28px] mt-1.5 leading-none">{settled.closedCount}</div>
        </div>
        <div>
          <div className="cap">Settled R — sum</div>
          <div className={`num text-[28px] mt-1.5 leading-none ${
            settled.closedCount === 0 ? 'text-dim' : settled.totalR > 0 ? 'text-pass' : settled.totalR < 0 ? 'text-fail' : ''
          }`}>
            {settled.closedCount === 0 ? '—' : `${settled.totalR > 0 ? '+' : ''}${formatRatio(settled.totalR)}R`}
          </div>
        </div>
      </div>
      {settled.pending > 0 && (
        <p className="text-muted text-[12px] mt-3">
          {settled.pending} {settled.pending === 1 ? 'entry has' : 'entries have'} no outcome recorded.
          Until {settled.pending === 1 ? 'it does' : 'they do'}, nothing here can say whether your
          rules earn their place.
        </p>
      )}

      <div className="flex gap-2 mt-8 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`cap px-3 py-1.5 cursor-pointer border ${
              filter === f.value ? 'bg-ink !text-paper border-ink' : 'border-rule hover:border-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="cap self-center ml-2">{visible.length} shown</span>
      </div>

      <div className="border-t border-ink mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="min-w-[820px]">
        <div className={`row row-head ${COLUMNS}`}>
          <div>Date</div>
          <div>{isTrading ? 'Asset' : 'Company'}</div>
          <div>Strategy</div>
          <div className="text-right">Verdict</div>
          <div className="text-right">{isTrading ? 'Entry' : 'Price'}</div>
          <div className="text-right">{isTrading ? 'RR' : 'Valuation'}</div>
          <div className="text-right">{isTrading ? 'Outcome' : 'Status'}</div>
          <div />
        </div>

        {visible.length === 0 && <Empty>Nothing matches this filter.</Empty>}

        {visible.map((record, index) => {
          const open = openId === record.id;
          const r = record.outcome?.kind === 'trade' ? record.outcome.rMultiple : null;
          return (
            <div key={record.id} className={open ? 'border-b border-hair' : ''}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : record.id)}
                className={`row w-full text-left cursor-pointer ${COLUMNS} hover:bg-paper-2 ${open ? '!border-b-0' : ''}`}
              >
                <div className="num text-[11.5px] text-faint whitespace-nowrap">
                  {new Date(record.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
                </div>
                <div className="ser text-[16px] truncate">{record.subject}</div>
                <div className="text-muted truncate text-[12px]">
                  {record.strategyName} <span className="num text-dim">v{record.strategyVersion}</span>
                </div>
                <div className="text-right"><VerdictPill verdict={record.verdict} /></div>
                <div className="num text-right text-[12.5px] text-muted">
                  {isTrading
                    ? (observed(record, 'entry') !== null ? formatFigure(observed(record, 'entry') as number) : '—')
                    : (observed(record, 'pe') !== null ? formatFigure(observed(record, 'pe') as number) : '—')}
                </div>
                <div className="num text-right text-[12.5px] text-muted">
                  {isTrading
                    ? (typeof record.computed['rr'] === 'number' ? `${formatRatio(record.computed['rr'])}x` : '—')
                    : (observed(record, 'forward_pe') !== null ? `${formatRatio(observed(record, 'forward_pe') as number)}x` : '—')}
                </div>
                <div className={`cap text-right ${OUTCOME_TONE[record.outcome?.status ?? ''] ?? 'text-dim'}`}>
                  {typeof r === 'number'
                    ? `${r > 0 ? '+' : ''}${formatRatio(r)}R`
                    : outcomeLabel(record.outcome)}
                </div>
                <div className="num text-dim text-right">{open ? '–' : '+'}</div>
              </button>

              {open && (
                <div className="pb-8 pt-2 grid lg:grid-cols-[minmax(0,1fr)_400px] gap-10 items-start">
                  <div>
                    <div className="cap mb-2">Rules as judged — version {record.strategyVersion}</div>
                    <RuleTable results={record.results} />
                    {record.screenshots && record.screenshots.length > 0 && (
                      <div className="mt-5">
                        <div className="doc mb-2">Chart as analysed</div>
                        <div className="flex flex-wrap gap-3">
                          {record.screenshots.map((shot, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={`data:${shot.mimeType};base64,${shot.base64}`}
                              alt={`Chart ${i + 1} for ${record.subject}`}
                              width={shot.width}
                              height={shot.height}
                              className="border border-rule max-w-full h-auto"
                              style={{ maxHeight: 360 }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {record.notes && (
                      <p className="text-muted text-[12px] mt-4 leading-relaxed">{record.notes}</p>
                    )}
                  </div>
                  <div className="border-t border-ink pt-4">
                    <OutcomeForm
                      record={record}
                      onSave={(outcome) => setOutcome(record.id, outcome)}
                      onClear={() => setOutcome(record.id, null)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </>
  );
}
