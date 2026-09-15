import type { Mode } from './rules';
import type { Verdict, RuleResult, AnalysisSummary } from './results';
import type { ObservationSet } from './observations';
import type { TradeStatus, InvestmentStatus } from '@/lib/calculations/outcome';

/**
 * What actually happened after the analysis.
 *
 * Kept separate from the analysis itself: a verdict is a statement about
 * compliance at a moment in time and never changes, while the outcome is
 * recorded later and can be corrected. Every derived figure here is computed
 * from the levels, never entered.
 */
export interface TradeOutcome {
  kind: 'trade';
  status: TradeStatus;
  /** Price the position was actually closed at. */
  exit: number | null;
  /** Derived from entry, stop and exit. Never typed in. */
  rMultiple: number | null;
  closedAt?: string;
  notes?: string;
  updatedAt: string;
}

export interface InvestmentOutcome {
  kind: 'investment';
  status: InvestmentStatus;
  buyPrice: number | null;
  sellPrice: number | null;
  /** Derived from buy and sell. */
  returnPercent: number | null;
  thesis?: string;
  notes?: string;
  updatedAt: string;
}

export type Outcome = TradeOutcome | InvestmentOutcome;

/**
 * A saved analysis. Deliberately stores the rule results and the observations
 * they came from, not just the verdict, so a result stays auditable after the
 * strategy has moved on.
 *
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
  /** Absent until the user records what happened. */
  outcome?: Outcome;
  /**
   * Reduced copies of the charts that were analysed, kept with the record so a
   * journal entry shows what was actually on screen. Reduced, because a 5 MB
   * original stored per entry would exhaust browser storage within a week.
   */
  screenshots?: StoredImage[];
}

export interface StoredImage {
  mimeType: string;
  /** Raw base64, no data: prefix. */
  base64: string;
  width: number;
  height: number;
}
