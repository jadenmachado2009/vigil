import type { RuleResult, RuleStatus } from '@/types/results';
import type { ObservationSource } from '@/types/observations';
import { StatusMark } from './index';

const SOURCE_LABEL: Record<ObservationSource, string> = {
  vision: 'Chart',
  'market-api': 'Market',
  'financial-api': 'Filings',
  user: 'You',
  computed: 'Computed',
  mock: 'Demo',
};

const COLUMNS = 'grid-cols-[34px_minmax(0,1fr)_128px_112px_84px]';

/**
 * The compliance record: numbered rows, thresholds and observations aligned on
 * the decimal, the finding last. Reads down the Observed column to the number
 * that broke.
 */
export function RuleTable({ results }: { results: RuleResult[] }) {
  return (
    <div>
      <div className={`row row-head ${COLUMNS}`}>
        <div>No.</div>
        <div>Rule</div>
        <div className="text-right">Required</div>
        <div className="text-right">Observed</div>
        <div className="text-right">Finding</div>
      </div>
      {results.map((result, index) => {
        const broke = result.status === 'FAIL';
        return (
          <div key={result.ruleId} className={`row ${COLUMNS} !items-start`}>
            <div className={`num text-[11px] ${broke ? 'text-fail' : 'text-dim'}`}>
              {String(index + 1).padStart(2, '0')}
            </div>
            <div className="min-w-0">
              <div className={`ser text-[15px] ${broke ? 'text-fail' : ''}`}>
                {result.label}
                {!result.mandatory && <span className="cap ml-2">Optional</span>}
                {result.mandatory && result.onFail === 'watch' && (
                  <span className="cap ml-2 !text-watch">Fails to watch</span>
                )}
              </div>
              <div className="text-muted text-[12px] leading-snug mt-1">
                {result.reason}
                {result.source && <span className="text-dim"> · {SOURCE_LABEL[result.source]}</span>}
                {result.stale && <span className="text-watch"> · Stale</span>}
              </div>
            </div>
            <div className="num text-right text-faint truncate" title={result.expected}>{result.expected}</div>
            <div
              className={`num text-right truncate ${result.actual === null ? 'text-dim' : broke ? 'text-fail' : ''}`}
              title={result.actual ?? undefined}
            >
              {result.actual ?? '—'}
            </div>
            <div className="text-right"><StatusMark status={result.status} /></div>
          </div>
        );
      })}
    </div>
  );
}

/** One segment per required rule, coloured by outcome. */
export function ComplianceMeter({ results }: { results: RuleResult[] }) {
  const mandatory = results.filter((r) => r.mandatory);
  if (mandatory.length === 0) return null;
  const fill: Record<RuleStatus, string> = {
    PASS: 'bg-pass',
    FAIL: 'bg-fail',
    UNCONFIRMED: 'bg-watch',
    UNKNOWN: 'bg-rule',
  };
  return (
    <div className="flex gap-[3px] h-[6px]" aria-hidden>
      {mandatory.map((r) => (
        <div key={r.ruleId} className={`flex-1 ${fill[r.status]}`} title={`${r.label}: ${r.status}`} />
      ))}
    </div>
  );
}
