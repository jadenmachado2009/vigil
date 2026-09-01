import type { StrategyVersion } from '@/types/rules';
import type { ObservationSet } from '@/types/observations';
import type { Analysis, RuleResult } from '@/types/results';
import { deriveMetrics, stripComputedMetrics } from './derive';
import { evaluateRule, type EvaluationOptions } from './evaluate-rule';
import { resolveVerdict } from './verdict';

export interface EvaluateInput {
  strategy: StrategyVersion;
  observations: ObservationSet;
  options?: Partial<EvaluationOptions>;
}

/** Freshness budgets differ by mode: a chart read goes stale in hours, fundamentals in months. */
const DEFAULT_MAX_AGE_DAYS = { trading: 1, investing: 120 } as const;

/**
 * The deterministic core of the product.
 *
 * Pipeline: strip provider-supplied computed metrics -> derive them in code ->
 * evaluate each enabled rule -> resolve a single verdict.
 *
 * This function performs no I/O, contains no randomness, and never calls a
 * model. Given the same strategy and observations it always returns the same
 * analysis.
 */
export function evaluateStrategy({ strategy, observations, options }: EvaluateInput): Analysis {
  const now = options?.now ?? new Date().toISOString();
  const resolved: EvaluationOptions = {
    now,
    maxAgeDays: options?.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS[strategy.mode],
    ...(options?.minConfidence !== undefined ? { minConfidence: options.minConfidence } : {}),
  };

  const { cleaned } = stripComputedMetrics(observations);
  const { observations: enriched, computed } = deriveMetrics(cleaned, now);

  const rules = strategy.rules.filter((r) => r.enabled);
  const results: RuleResult[] = rules.map((rule) => evaluateRule(rule, enriched, resolved));

  const { verdict, reason } = resolveVerdict(results);
  const mandatory = results.filter((r) => r.mandatory);
  const optional = results.filter((r) => !r.mandatory);

  return {
    verdict,
    results,
    reason,
    computed,
    evaluatedAt: now,
    strategyVersionId: strategy.id,
    summary: {
      mandatoryTotal: mandatory.length,
      mandatoryPassed: mandatory.filter((r) => r.status === 'PASS').length,
      optionalTotal: optional.length,
      optionalPassed: optional.filter((r) => r.status === 'PASS').length,
    },
  };
}
