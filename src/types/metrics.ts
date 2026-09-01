/**
 * A metric is anything the system can observe or compute about an opportunity.
 * The catalog (src/lib/metrics/catalog.ts) is the single source of truth for
 * what a rule is allowed to reference and what unit its value arrives in.
 */

export type Mode = 'trading' | 'investing';

export type Unit =
  | 'percent'   // 15 means 15%
  | 'ratio'     // 0.15 means 15%
  | 'multiple'  // 2.0x  (RR, EV/EBITDA, P/E, Debt/EBITDA)
  | 'price'     // instrument price, in the instrument's quote currency
  | 'currency'  // account currency amount
  | 'count'
  | 'boolean'
  | 'time'      // ISO-8601 timestamp
  | 'text';

export type MetricKind = 'numeric' | 'boolean' | 'temporal' | 'categorical';

/**
 * `observed`  - supplied by a provider (vision model, financial API, or the user).
 * `computed`  - derived by application code from other observations.
 *
 * A computed metric may NEVER be supplied by a provider. The engine strips any
 * incoming observation for a computed metric before evaluating, so an LLM cannot
 * hand us a risk/reward ratio or a PEG and have it trusted. See PRINCIPLE in
 * src/lib/rules-engine/derive.ts.
 */
export type MetricOrigin = 'observed' | 'computed';

export interface MetricDef {
  id: string;
  label: string;
  kind: MetricKind;
  mode: Mode | 'both';
  unit: Unit;
  origin: MetricOrigin;
  /** UI grouping in the strategy builder. */
  group: string;
  description: string;
  /**
   * Which direction is "better", where meaningful. Used only for UI hints and
   * default operator selection - never for evaluation.
   */
  preferred?: 'higher' | 'lower';
}
