import type { Mode, Unit } from './metrics.js';

export type ComparisonOperator = '>=' | '<=' | '>' | '<' | '==' | '!=';

/**
 * What a failing mandatory rule means for the overall verdict.
 * Spec section 8: the user decides whether a failed valuation rule rejects an
 * opportunity outright or merely moves it to the watchlist.
 */
export type FailurePolicy = 'reject' | 'watch';

interface RuleBase {
  id: string;
  /** Human-readable label shown in results. Not used for matching. */
  label: string;
  mandatory: boolean;
  onFail: FailurePolicy;
  enabled: boolean;
  note?: string;
}

export interface NumericRule extends RuleBase {
  kind: 'numeric';
  metric: string;
  operator: ComparisonOperator;
  value: number;
  /** Unit the threshold is expressed in; normalised to the metric's canonical unit. */
  unit: Unit;
}

export interface BooleanRule extends RuleBase {
  kind: 'boolean';
  metric: string;
  expected: boolean;
}

export interface SessionWindow {
  /** "HH:mm", inclusive. */
  start: string;
  /** "HH:mm", exclusive. May be earlier than `start` for windows crossing midnight. */
  end: string;
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
}

export interface TemporalRule extends RuleBase {
  kind: 'temporal';
  metric: string;
  window: SessionWindow;
}

export interface CategoricalRule extends RuleBase {
  kind: 'categorical';
  metric: string;
  operator: 'in' | 'not_in';
  values: string[];
}

export type Rule = NumericRule | BooleanRule | TemporalRule | CategoricalRule;

/**
 * Strategies are versioned immutably. An Analysis references a StrategyVersion,
 * never a Strategy, so that editing a strategy cannot retroactively change the
 * meaning of historical results. Rule-level attribution analytics (spec 14)
 * depend on this.
 */
export interface StrategyVersion {
  id: string;
  strategyId: string;
  version: number;
  mode: Mode;
  rules: Rule[];
  createdAt: string;
}

export interface Strategy {
  id: string;
  name: string;
  mode: Mode;
  description?: string;
  currentVersionId: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}
