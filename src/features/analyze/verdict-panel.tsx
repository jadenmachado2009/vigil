'use client';

import type { AnalysisRecord } from '@/types/analysis';
import { Card, VerdictPill } from '@/components/ui';
import { RuleTable, ComplianceMeter } from '@/components/ui/rule-table';

const VERDICT_BLURB: Record<AnalysisRecord['verdict'], string> = {
  QUALIFIED: 'Every required rule passed.',
  WATCH: 'Nothing failed outright, but this is not confirmed yet.',
  REJECTED: 'A required rule was broken.',
  INSUFFICIENT_DATA: 'Something required could not be verified. Nothing was assumed.',
};

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[1px] text-faint font-bold">{label}</div>
      <div className="num text-[13px] mt-1 text-[#c3ccd5] truncate">{value}</div>
    </div>
  );
}

export function VerdictPanel({
  record,
  warnings,
  demoLabel,
}: {
  record: AnalysisRecord;
  warnings: string[];
  demoLabel: string;
}) {
  const { summary } = record;
  return (
    <Card className="overflow-hidden">
      {record.provider.isMock && (
        <div className="border-b border-[#3f3a20] bg-[#16150c] px-5 py-2.5 text-warn text-[12px] leading-relaxed">
          <b className="uppercase tracking-wider text-[11px]">Demo data</b> · {demoLabel} The rules
          engine below is real — only the inputs are simulated.
        </div>
      )}

      {/* Readout strip */}
      <div className="px-5 pt-5 pb-4 border-b border-line">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="eyebrow">Strategy compliance</div>
            <div className="text-[27px] font-bold tracking-[-0.8px] mt-1.5 leading-none">
              {record.verdict.replace('_', ' ')}
            </div>
            <p className="text-muted mt-2 text-[13px]">{VERDICT_BLURB[record.verdict]}</p>
          </div>
          <VerdictPill verdict={record.verdict} />
        </div>

        <ComplianceMeter results={record.results} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <Meta label="Subject" value={record.subject} />
          <Meta label="Strategy" value={`${record.strategyName} v${record.strategyVersion}`} />
          <Meta
            label="Required"
            value={`${summary.mandatoryPassed}/${summary.mandatoryTotal}${
              summary.optionalTotal ? `  (+${summary.optionalPassed}/${summary.optionalTotal} opt)` : ''
            }`}
          />
          <Meta label="Checked" value={new Date(record.createdAt).toLocaleString()} />
        </div>
      </div>

      <div className="p-5">
        <RuleTable results={record.results} />

        <div className="mt-4 rounded-[10px] bg-[#0b0f14] border border-line px-4 py-3.5">
          <div className="eyebrow">Verdict reasoning</div>
          <p className="mt-2 leading-relaxed text-[13px]">{record.reason}</p>
          {typeof record.computed['rr'] === 'number' && (
            <p className="text-faint text-[12px] mt-3">
              Risk/reward computed by the app from your levels:{' '}
              <span className="num text-[#c3ccd5]">{record.computed['rr'].toFixed(2)}x</span>
              {typeof record.computed['risk'] === 'number' && (
                <> · risk <span className="num">{record.computed['risk']}</span> · reward{' '}
                  <span className="num">{record.computed['reward']}</span></>
              )}
            </p>
          )}
          {typeof record.computed['fcf_margin'] === 'number' && (
            <p className="text-faint text-[12px] mt-2">
              FCF margin computed from revenue and free cash flow:{' '}
              <span className="num text-[#c3ccd5]">{record.computed['fcf_margin'].toFixed(1)}%</span>
            </p>
          )}
        </div>

        {warnings.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-faint text-[12px] leading-relaxed pl-3 border-l border-line">{w}</li>
            ))}
          </ul>
        )}

        <p className="text-[#5a646f] text-[11px] mt-5 leading-relaxed">
          Compliance with rules you wrote. Not a prediction, a recommendation, or financial advice.
        </p>
      </div>
    </Card>
  );
}
