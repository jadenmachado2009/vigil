import type { RuleResult, RuleStatus } from '@/types/results';
import type { ObservationSource } from '@/types/observations';

const MARK: Record<RuleStatus, { glyph: string; label: string; className: string }> = {
  PASS: { glyph: '✓', label: 'pass', className: 'text-good' },
  FAIL: { glyph: '✗', label: 'fail', className: 'text-danger' },
  UNCONFIRMED: { glyph: '◔', label: 'pending', className: 'text-warn' },
  UNKNOWN: { glyph: '–', label: 'no data', className: 'text-faint' },
};

const SOURCE_LABEL: Record<ObservationSource, string> = {
  vision: 'chart',
  'market-api': 'market',
  'financial-api': 'filings',
  user: 'you',
  computed: 'calculated',
  mock: 'demo',
};

const COLUMNS = 'grid-cols-[minmax(0,1fr)_88px_88px_92px]';

/**
 * Dense results table: one row per rule, thresholds and observations aligned on
 * the decimal, reasons demoted to a secondary line. Reads like a compliance
 * report, not a feed of cards.
 */
export function RuleTable({ results }: { results: RuleResult[] }) {
  return (
    <div className="border border-line rounded-[10px] overflow-hidden">
      <div className={`data-row data-head ${COLUMNS}`}>
        <div>Rule</div>
        <div className="text-right">Required</div>
        <div className="text-right">Observed</div>
        <div className="text-right">Result</div>
      </div>
      {results.map((result) => {
        const mark = MARK[result.status];
        return (
          <div key={result.ruleId} className={`data-row ${COLUMNS} !items-start !py-2.5`}>
            <div className="min-w-0">
              <div className="truncate">
                {result.label}
                {!result.mandatory && (
                  <span className="text-faint text-[11px] ml-2 uppercase tracking-wide">opt</span>
                )}
                {result.mandatory && result.onFail === 'watch' && (
                  <span className="text-warn/70 text-[11px] ml-2 uppercase tracking-wide">watch</span>
                )}
              </div>
              <div className="text-faint text-[12px] leading-snug mt-0.5">
                {result.reason}
                {result.source && (
                  <span className="text-[#5a646f]"> · {SOURCE_LABEL[result.source]}</span>
                )}
                {result.stale && <span className="text-warn/80"> · stale</span>}
              </div>
            </div>
            <div className="num text-right text-[#aab4bf] whitespace-nowrap">{result.expected}</div>
            <div className={`num text-right whitespace-nowrap ${result.actual === null ? 'text-[#4d565f]' : 'text-ink'}`}>
              {result.actual ?? '—'}
            </div>
            <div className={`text-right text-[12px] font-bold whitespace-nowrap ${mark.className}`}>
              <span className="mr-1">{mark.glyph}</span>{mark.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * One segment per required rule, coloured by outcome. Shows at a glance how much
 * of the strategy held without reducing it to a single percentage.
 */
export function ComplianceMeter({ results }: { results: RuleResult[] }) {
  const mandatory = results.filter((r) => r.mandatory);
  if (mandatory.length === 0) return null;
  const fill: Record<RuleStatus, string> = {
    PASS: 'bg-good',
    FAIL: 'bg-danger',
    UNCONFIRMED: 'bg-warn',
    UNKNOWN: 'bg-[#2b333c]',
  };
  return (
    <div className="flex gap-[3px] h-[5px] mt-3" aria-hidden>
      {mandatory.map((r) => (
        <div key={r.ruleId} className={`flex-1 rounded-full ${fill[r.status]}`} title={`${r.label}: ${r.status}`} />
      ))}
    </div>
  );
}
