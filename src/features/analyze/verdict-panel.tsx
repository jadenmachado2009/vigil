'use client';

import type { AnalysisRecord } from '@/types/analysis';
import { Card, VerdictPill } from '@/components/ui';
import { RuleTable, ComplianceMeter } from '@/components/ui/rule-table';
import { formatFigure, formatMultiple, formatPercent } from '@/lib/format';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className="num text-[12px] mt-1 text-muted truncate">{value}</div>
    </div>
  );
}

export function VerdictPanel({
  record, warnings, demoLabel,
}: {
  record: AnalysisRecord;
  warnings: string[];
  demoLabel: string;
}) {
  const { summary } = record;
  return (
    <Card className="overflow-hidden">
      {record.provider.isMock && (
        <div className="border-b border-line bg-surface-2 px-4 py-2 text-[12px] text-watch flex gap-2">
          <span className="num text-[10px] tracking-[0.1em] shrink-0 pt-[2px]">DEMO</span>
          <span className="text-muted">{demoLabel}</span>
        </div>
      )}

      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="num text-[22px] font-semibold tracking-[-0.01em] leading-none">
            {record.verdict.replace('_', ' ')}
          </div>
          <VerdictPill verdict={record.verdict} />
        </div>
        <div className="mt-3"><ComplianceMeter results={record.results} /></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
          <Field label="Subject" value={record.subject} />
          <Field label="Strategy" value={`${record.strategyName} v${record.strategyVersion}`} />
          <Field
            label="Required"
            value={`${summary.mandatoryPassed}/${summary.mandatoryTotal}${
              summary.optionalTotal ? ` +${summary.optionalPassed}/${summary.optionalTotal}` : ''
            }`}
          />
          <Field label="Checked" value={new Date(record.createdAt).toLocaleString()} />
        </div>
      </div>

      <div className="px-4 pb-4">
        <RuleTable results={record.results} />

        <div className="mt-3 border-l-2 border-line-strong pl-3 py-1">
          <p className="leading-relaxed">{record.reason}</p>
          {typeof record.computed['rr'] === 'number' && (
            <p className="text-faint text-[12px] mt-2">
              RR computed from your levels:{' '}
              <span className="num text-muted">{formatMultiple(record.computed['rr'])}</span>
              {typeof record.computed['risk'] === 'number' && typeof record.computed['reward'] === 'number' && (
                <> · risk <span className="num">{formatFigure(record.computed['risk'])}</span> · reward{' '}
                  <span className="num">{formatFigure(record.computed['reward'])}</span></>
              )}
            </p>
          )}
          {typeof record.computed['fcf_margin'] === 'number' && (
            <p className="text-faint text-[12px] mt-1">
              FCF margin computed:{' '}
              <span className="num text-muted">{formatPercent(record.computed['fcf_margin'])}</span>
            </p>
          )}
        </div>

        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-dim text-[12px] leading-snug">{w}</li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
