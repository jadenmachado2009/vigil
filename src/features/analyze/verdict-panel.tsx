'use client';

import type { AnalysisRecord } from '@/types/analysis';
import type { ObservationSource } from '@/types/observations';
import { Card, VerdictPill, StatusMark } from '@/components/ui';

const SOURCE_LABEL: Record<ObservationSource, string> = {
  vision: 'chart',
  'market-api': 'market data',
  'financial-api': 'fundamentals',
  user: 'you',
  computed: 'calculated',
  mock: 'demo',
};

const VERDICT_BLURB: Record<AnalysisRecord['verdict'], string> = {
  QUALIFIED: 'Every required rule passed.',
  WATCH: 'Nothing has failed outright, but this is not confirmed yet.',
  REJECTED: 'A required rule was broken.',
  INSUFFICIENT_DATA: 'Something required could not be verified. Nothing was assumed.',
};

export function VerdictPanel({ record, warnings }: { record: AnalysisRecord; warnings: string[] }) {
  const { summary } = record;
  return (
    <Card className="p-6">
      {record.provider.isMock && (
        <div className="mb-5 rounded-[9px] border border-[#4a4327] bg-[#1d1a0e] px-4 py-3 text-warn leading-relaxed">
          <b>Demo reading.</b> These observations were generated locally, not read from your chart.
          The rules engine below is real — only the chart reading is simulated.
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow">Strategy compliance</div>
          <div className="text-[26px] font-bold tracking-tight mt-1.5">
            {record.verdict.replace('_', ' ')}
          </div>
          <p className="text-muted mt-1">{VERDICT_BLURB[record.verdict]}</p>
        </div>
        <VerdictPill verdict={record.verdict} />
      </div>

      <div className="text-muted mt-4 pb-4 border-b border-line">
        {summary.mandatoryPassed}/{summary.mandatoryTotal} required rules passed
        {summary.optionalTotal > 0 && ` · ${summary.optionalPassed}/${summary.optionalTotal} optional`}
        {' · '}{record.subject}
        {' · '}{record.strategyName} v{record.strategyVersion}
      </div>

      <div className="mt-2">
        {record.results.map((result) => (
          <div key={result.ruleId} className="py-3 border-b border-line last:border-0">
            <div className="flex items-baseline justify-between gap-4">
              <div className="font-bold">
                {result.label}
                {!result.mandatory && <span className="text-faint font-normal ml-2 text-[12px]">optional</span>}
                {result.mandatory && result.onFail === 'watch' && (
                  <span className="text-faint font-normal ml-2 text-[12px]">fails → watch</span>
                )}
              </div>
              <StatusMark status={result.status} />
            </div>
            <div className="text-muted mt-1 leading-relaxed">{result.reason}</div>
            <div className="text-faint text-[12px] mt-1">
              needs {result.expected}
              {result.actual !== null && ` · observed ${result.actual}`}
              {result.source && ` · source: ${SOURCE_LABEL[result.source]}`}
              {result.stale && ' · stale'}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[9px] bg-[#0b0f14] border border-line p-4">
        <div className="eyebrow">Why</div>
        <p className="mt-2 leading-relaxed">{record.reason}</p>
        {typeof record.computed['rr'] === 'number' && (
          <p className="text-faint text-[12px] mt-3">
            Risk/reward calculated by the app from your levels: {record.computed['rr'].toFixed(2)}x
            {typeof record.computed['risk'] === 'number' && ` (risk ${record.computed['risk']}, reward ${record.computed['reward']})`}
          </p>
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="mt-4 text-faint text-[12px] leading-relaxed list-disc pl-4">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      <p className="text-faint text-[12px] mt-5 leading-relaxed">
        This describes compliance with rules you wrote. It is not a prediction, a recommendation,
        or financial advice.
      </p>
    </Card>
  );
}
