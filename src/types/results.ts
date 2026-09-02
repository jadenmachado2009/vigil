import type { Rule } from './rules';
import type { ObservationSource } from './observations';

/**
 * PASS        - condition met.
 * FAIL        - condition definitively not met.
 * UNCONFIRMED - observable, currently not met, but may still become true.
 * UNKNOWN     - could not be determined. Never treated as pass or fail.
 */
export type RuleStatus = 'PASS' | 'FAIL' | 'UNCONFIRMED' | 'UNKNOWN';

export type Verdict = 'QUALIFIED' | 'WATCH' | 'REJECTED' | 'INSUFFICIENT_DATA';

export interface RuleResult {
  ruleId: string;
  /**
   * The metric this rule tested. Stable across strategy versions and across
   * label edits, so it — not the rule id or the label — is what groups a
   * condition's history together for attribution.
   */
  metric: string;
  label: string;
  status: RuleStatus;
  mandatory: boolean;
  onFail: Rule['onFail'];
  /** Human-readable threshold, e.g. ">= 15%". */
  expected: string;
  /** Human-readable observed value, or null when unknown. */
  actual: string | null;
  /** Plain-language explanation, safe to show the user verbatim. */
  reason: string;
  source?: ObservationSource;
  asOf?: string;
  /** Set when the observation was older than the configured freshness budget. */
  stale?: boolean;
}

export interface AnalysisSummary {
  mandatoryTotal: number;
  mandatoryPassed: number;
  optionalTotal: number;
  optionalPassed: number;
}

export interface Analysis {
  verdict: Verdict;
  /** Ordered, one per enabled rule. */
  results: RuleResult[];
  summary: AnalysisSummary;
  /** Why the verdict is what it is, in one sentence. */
  reason: string;
  /** Metrics the engine computed itself, for audit and display. */
  computed: Record<string, number | null>;
  evaluatedAt: string;
  strategyVersionId: string;
}
