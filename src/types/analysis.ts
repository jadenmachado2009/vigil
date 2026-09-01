import type { Mode } from './rules';
import type { Verdict, RuleResult, AnalysisSummary } from './results';
import type { ObservationSet } from './observations';

/**
 * A saved analysis. Deliberately stores the rule results and the observations
 * they came from, not just the verdict, so a result stays auditable after the
 * strategy has moved on.
 *
 * Phase 7 extends this with outcome, R multiple and exit data.
 */
export interface AnalysisRecord {
  id: string;
  createdAt: string;
  mode: Mode;
  /** Instrument or company the analysis was about. */
  subject: string;
  strategyId: string;
  strategyName: string;
  strategyVersionId: string;
  strategyVersion: number;
  verdict: Verdict;
  reason: string;
  summary: AnalysisSummary;
  results: RuleResult[];
  computed: Record<string, number | null>;
  observations: ObservationSet;
  provider: { name: string; isMock: boolean };
  notes?: string;
}
