'use client';

import type { AnalysisRecord } from '@/types/analysis';
import { VerdictPill } from '@/components/ui';
import { RuleTable, ComplianceMeter } from '@/components/ui/rule-table';
import { formatFigure, formatMultiple, formatPercent } from '@/lib/format';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const spell = (n: number) => WORDS[n] ?? String(n);

/**
 * The finding as a sentence, with the part that carries the verdict marked for
 * emphasis. Counts come from the results themselves: a rule that could not be
 * verified has not been "broken", so it must not be counted as one.
 */
function sentence(record: AnalysisRecord): { before: string; emphasis: string; after: string } {
  const mandatory = record.results.filter((r) => r.mandatory);
  const total = mandatory.length;
  const failed = mandatory.filter((r) => r.status === 'FAIL').length;
  const unknown = mandatory.filter((r) => r.status === 'UNKNOWN').length;
  const pending = mandatory.filter((r) => r.status === 'UNCONFIRMED').length;

  switch (record.verdict) {
    case 'QUALIFIED':
      return { before: 'This satisfies ', emphasis: `all ${spell(total)}`, after: ' of your required rules.' };
    case 'REJECTED':
      return {
        before: 'This breaks ',
        emphasis: `${spell(failed)} of your ${spell(total)}`,
        after: ` required rule${total === 1 ? '' : 's'}.`,
      };
    case 'WATCH':
      return {
        before: 'Nothing has broken, but ',
        emphasis: `${spell(pending)} rule${pending === 1 ? ' is' : 's are'}`,
        after: ' not confirmed yet.',
      };
    case 'INSUFFICIENT_DATA':
      return {
        before: '',
        emphasis: `${spell(unknown)} required rule${unknown === 1 ? '' : 's'}`,
        after: ` could not be verified. Nothing was assumed to pass.`,
      };
  }
}

const VERDICT_TONE: Record<AnalysisRecord['verdict'], string> = {
  QUALIFIED: 'text-pass',
  REJECTED: 'text-fail',
  WATCH: 'text-watch',
  INSUFFICIENT_DATA: 'text-none',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="cap">{label}</div>
      <div className="num text-[13px] mt-1.5 text-ink-2 truncate">{value}</div>
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
  const phrase = sentence(record);
  return (
    <div>
      {record.provider.isMock && (
        <div className="border-y border-rule py-2 mb-6 flex gap-3">
          <span className="cap shrink-0 !text-watch">Demo</span>
          <span className="text-muted text-[12px]">{demoLabel}</span>
        </div>
      )}

      {/* The finding, stated before the evidence. */}
      <div className="ser text-[40px] leading-[1.05] text-muted max-w-[22ch]">
        {phrase.before}
        <span className={VERDICT_TONE[record.verdict]}>{phrase.emphasis}</span>
        {phrase.after}
      </div>

      <div className="border-t border-ink mt-7 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-6">
        <Field label="Subject" value={record.subject} />
        <Field label="Strategy" value={`${record.strategyName} v${record.strategyVersion}`} />
        <Field
          label="Required met"
          value={`${summary.mandatoryPassed}/${summary.mandatoryTotal}${
            summary.optionalTotal ? ` (+${summary.optionalPassed}/${summary.optionalTotal})` : ''
          }`}
        />
        <Field label="Evaluated" value={new Date(record.createdAt).toLocaleString()} />
      </div>

      <div className="mt-4"><ComplianceMeter results={record.results} /></div>

      <div className="mt-8">
        <RuleTable results={record.results} />
      </div>

      <div className="grid md:grid-cols-2 gap-8 mt-8">
        <div>
          <div className="cap">Verdict</div>
          <div className="flex items-baseline gap-4 mt-2">
            <span className={`ser text-[34px] leading-none ${VERDICT_TONE[record.verdict]}`}>
              {record.verdict === 'INSUFFICIENT_DATA' ? 'No verdict' : record.verdict.charAt(0) + record.verdict.slice(1).toLowerCase()}
            </span>
            <VerdictPill verdict={record.verdict} />
          </div>
          <p className="text-muted text-[12.5px] mt-3 leading-relaxed">{record.reason}</p>
          {typeof record.computed['rr'] === 'number' && (
            <p className="text-faint text-[12px] mt-3">
              Ratio computed from your levels: <span className="num text-ink-2">{formatMultiple(record.computed['rr'])}</span>
              {typeof record.computed['risk'] === 'number' && typeof record.computed['reward'] === 'number' && (
                <> · risk <span className="num">{formatFigure(record.computed['risk'])}</span> · reward{' '}
                  <span className="num">{formatFigure(record.computed['reward'])}</span></>
              )}
            </p>
          )}
          {typeof record.computed['fcf_margin'] === 'number' && (
            <p className="text-faint text-[12px] mt-1.5">
              FCF margin computed: <span className="num text-ink-2">{formatPercent(record.computed['fcf_margin'])}</span>
            </p>
          )}
        </div>

        <div>
          <div className="cap">Method &amp; provenance</div>
          <p className="text-muted text-[12px] leading-relaxed mt-2">
            The reading and the decision are separate. A model may report what it sees; it is never
            asked for a ratio and never asked whether a setup is good. Every threshold here was
            compared by application code against rules you wrote, and an unverified condition is
            reported as such — never assumed to pass.
          </p>
          {warnings.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {warnings.map((w, i) => <li key={i} className="text-dim text-[11.5px] leading-snug">{w}</li>)}
            </ul>
          )}
          <p className="text-dim text-[11px] mt-4 leading-relaxed">
            Compliance with your own framework. Not a prediction, recommendation, or financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
