import type { RuleResult, RuleStatus } from '@/types/results';
import type { ObservationSource } from '@/types/observations';
import { StatusMark } from './index';

const SOURCE_LABEL: Record<ObservationSource, string> = {
  vision: 'chart',
  'market-api': 'market',
  'financial-api': 'filings',
  user: 'you',
  computed: 'calc',
  mock: 'demo',
};

// Required is sized to hold a full session window (09:30–11:00) without truncating.
const COLUMNS = 'grid-cols-[minmax(0,1fr)_96px_88px_66px_54px]';

/**
 * The compliance table. Thresholds and observations align on the decimal so the
 * eye can run down the Observed column and land on the number that broke.
 * Reasons sit underneath in a quieter register rather than in their own column.
 */
export function RuleTable({ results }: { results: RuleResult[] }) {
  return (
    <div className="border border-line rounded-[4px] overflow-hidden">
      <div className={`row row-head ${COLUMNS}`}>
        <div>Rule</div>
        <div className="text-right">Required</div>
        <div className="text-right">Observed</div>
        <div className="text-right">Result</div>
        <div className="text-right">Source</div>
      </div>
      {results.map((result) => (
        <div key={result.ruleId} className={`row ${COLUMNS} !items-start !py-2`}>
          <div className="min-w-0">
            <span className="truncate">{result.label}</span>
            {!result.mandatory && <span className="num text-[10px] text-dim ml-2">opt</span>}
            {result.mandatory && result.onFail === 'watch' && (
              <span className="num text-[10px] text-watch/70 ml-2">→watch</span>
            )}
            <div className="text-faint text-[12px] leading-snug mt-0.5">{result.reason}</div>
          </div>
          <div className="num text-right text-muted truncate" title={result.expected}>{result.expected}</div>
          <div
            className={`num text-right truncate ${result.actual === null ? 'text-dim' : 'text-ink'}`}
            title={result.actual ?? undefined}
          >
            {result.actual ?? '—'}
          </div>
          <div className="text-right"><StatusMark status={result.status} /></div>
          <div className="num text-right text-[11px] text-dim whitespace-nowrap">
            {result.source ? SOURCE_LABEL[result.source] : '—'}
            {result.stale && <span className="text-watch/80"> stale</span>}
          </div>
        </div>
      ))}
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
    UNKNOWN: 'bg-[#333b44]',
  };
  return (
    <div className="flex gap-[2px] h-[3px]" aria-hidden>
      {mandatory.map((r) => (
        <div key={r.ruleId} className={`flex-1 ${fill[r.status]}`} title={`${r.label}: ${r.status}`} />
      ))}
    </div>
  );
}
