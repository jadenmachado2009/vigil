'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AnalysisRecord, Outcome } from '@/types/analysis';
import { analysisRepository } from '@/lib/repository/client';
import { isClosed, wasTaken, type TradeStatus } from '@/lib/calculations/outcome';
import { formatFigure } from '@/lib/format';
import { Button, VerdictPill, Empty } from '@/components/ui';
import { RuleTable } from '@/components/ui/rule-table';
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

export function Journal() {
  const [records, setRecords] = useState<AnalysisRecord[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => setRecords(await analysisRepository.list()), []);
  useEffect(() => { void load(); }, [load]);

  const all = records ?? [];

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
      <Empty>
        Nothing checked yet. The journal fills itself — every opportunity you check is recorded here,
        and you add what happened afterwards.
        <div className="mt-6"><Link href="/analyze"><Button>Check an opportunity</Button></Link></div>
      </Empty>
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
            {settled.closedCount === 0 ? '—' : `${settled.totalR > 0 ? '+' : ''}${formatFigure(settled.totalR, 2)}R`}
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

      <div className="border-t border-ink mt-4">
        <div className="row row-head grid-cols-[34px_minmax(0,1fr)_150px_120px_110px_84px_28px]">
          <div>No.</div><div>Subject</div><div>Strategy</div><div>Checked</div>
          <div className="text-right">Verdict</div><div className="text-right">Outcome</div><div />
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
                className={`row w-full text-left cursor-pointer grid-cols-[34px_minmax(0,1fr)_150px_120px_110px_84px_28px] hover:bg-paper-2 ${open ? '!border-b-0' : ''}`}
              >
                <div className="num text-[11px] text-dim">{String(index + 1).padStart(2, '0')}</div>
                <div className="num truncate">{record.subject}</div>
                <div className="text-muted truncate text-[12px]">
                  {record.strategyName} <span className="num text-dim">v{record.strategyVersion}</span>
                </div>
                <div className="num text-[12px] text-faint">{new Date(record.createdAt).toLocaleDateString()}</div>
                <div className="text-right"><VerdictPill verdict={record.verdict} /></div>
                <div className={`cap text-right ${OUTCOME_TONE[record.outcome?.status ?? ''] ?? 'text-dim'}`}>
                  {typeof r === 'number'
                    ? `${r > 0 ? '+' : ''}${formatFigure(r, 2)}R`
                    : outcomeLabel(record.outcome)}
                </div>
                <div className="num text-dim text-right">{open ? '–' : '+'}</div>
              </button>

              {open && (
                <div className="pb-8 pt-2 grid lg:grid-cols-[minmax(0,1fr)_400px] gap-10 items-start">
                  <div>
                    <div className="cap mb-2">Rules as judged — version {record.strategyVersion}</div>
                    <RuleTable results={record.results} />
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
    </>
  );
}
