import type { Rule } from '@/types/rules.js';
import type { ObservationSet, Observation } from '@/types/observations.js';
import type { RuleResult } from '@/types/results.js';
import { getMetric } from '@/lib/metrics/catalog.js';
import { compareNumbers, operatorLabel } from '@/lib/calculations/compare.js';
import { convert, areUnitsCompatible } from '@/lib/calculations/units.js';
import { isWithinSession, ageInDays } from '@/lib/calculations/time.js';

export interface EvaluationOptions {
  /** Evaluation timestamp. Injected so results are reproducible in tests. */
  now: string;
  /** Observations older than this are treated as UNKNOWN, not as facts. */
  maxAgeDays?: number;
  /** Observations below this confidence are treated as UNKNOWN. */
  minConfidence?: number;
}

function unknown(rule: Rule, expected: string, reason: string, obs?: Observation): RuleResult {
  return {
    ruleId: rule.id,
    label: rule.label,
    status: 'UNKNOWN',
    mandatory: rule.mandatory,
    onFail: rule.onFail,
    expected,
    actual: null,
    reason,
    ...(obs ? { source: obs.source, asOf: obs.asOf } : {}),
  };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function describeExpected(rule: Rule): string {
  switch (rule.kind) {
    case 'numeric': {
      const suffix = rule.unit === 'percent' ? '%' : rule.unit === 'multiple' ? 'x' : '';
      return `${operatorLabel(rule.operator)} ${formatNumber(rule.value)}${suffix}`;
    }
    case 'boolean':
      return rule.expected ? 'present' : 'absent';
    case 'temporal':
      return `${rule.window.start}–${rule.window.end} ${rule.window.timezone}`;
    case 'categorical':
      return `${rule.operator === 'in' ? 'one of' : 'not one of'} ${rule.values.join(', ')}`;
  }
}

/**
 * Evaluates one rule against the observation set.
 *
 * The only way to reach PASS or FAIL is a definite observation. Missing, stale,
 * low-confidence and unparseable observations all resolve to UNKNOWN, and a
 * `pending` observation that does not satisfy the rule resolves to UNCONFIRMED.
 * Nothing here ever assumes a missing fact is true.
 */
export function evaluateRule(
  rule: Rule,
  observations: ObservationSet,
  options: EvaluationOptions,
): RuleResult {
  const expected = describeExpected(rule);
  const metric = getMetric(rule.metric);
  if (!metric) {
    return unknown(rule, expected, `Unknown metric "${rule.metric}". This rule could not be evaluated.`);
  }

  const obs = observations[rule.metric];
  if (!obs) {
    return unknown(rule, expected, `${metric.label} was not reported by any data source. This rule was not assumed to pass.`);
  }
  if (obs.value === null) {
    return unknown(rule, expected, obs.note ?? `${metric.label} could not be verified from the available data. This rule was not assumed to pass.`);
  }

  if (options.minConfidence !== undefined && obs.confidence !== undefined && obs.confidence < options.minConfidence) {
    return unknown(rule, expected, `${metric.label} was read with low confidence (${Math.round(obs.confidence * 100)}%). This rule was not assumed to pass.`, obs);
  }

  const age = ageInDays(obs.asOf, options.now);
  if (options.maxAgeDays !== undefined && age !== null && age > options.maxAgeDays) {
    return {
      ...unknown(rule, expected, `${metric.label} is ${Math.floor(age)} days old, beyond the ${options.maxAgeDays}-day freshness limit. This rule was not assumed to pass.`, obs),
      stale: true,
    };
  }

  const base = {
    ruleId: rule.id,
    label: rule.label,
    mandatory: rule.mandatory,
    onFail: rule.onFail,
    expected,
    source: obs.source,
    asOf: obs.asOf,
  };

  /** A rule that is not satisfied is FAIL, unless the observer flagged the fact as not yet resolved. */
  const notSatisfied = (actual: string, verb: string): RuleResult =>
    obs.pending
      ? { ...base, status: 'UNCONFIRMED', actual, reason: `${metric.label} ${verb} and has not been confirmed yet.` }
      : { ...base, status: 'FAIL', actual, reason: `${metric.label} ${verb}.` };

  switch (rule.kind) {
    case 'numeric': {
      if (typeof obs.value !== 'number' || !Number.isFinite(obs.value)) {
        return unknown(rule, expected, `${metric.label} was not a usable number.`, obs);
      }
      const obsUnit = obs.unit ?? metric.unit;
      if (!areUnitsCompatible(rule.unit, metric.unit) || !areUnitsCompatible(obsUnit, metric.unit)) {
        return unknown(rule, expected, `${metric.label} units do not match the rule (${obsUnit} vs ${rule.unit}).`, obs);
      }
      const actualValue = convert(obs.value, obsUnit, metric.unit);
      const threshold = convert(rule.value, rule.unit, metric.unit);
      const suffix = metric.unit === 'percent' ? '%' : metric.unit === 'multiple' ? 'x' : '';
      const actual = `${formatNumber(actualValue)}${suffix}`;
      return compareNumbers(actualValue, rule.operator, threshold)
        ? { ...base, status: 'PASS', actual, reason: `${metric.label} is ${actual}, which satisfies ${expected}.` }
        : notSatisfied(actual, `is ${actual}, which does not satisfy ${expected}`);
    }

    case 'boolean': {
      if (typeof obs.value !== 'boolean') {
        return unknown(rule, expected, `${metric.label} was not a usable true/false value.`, obs);
      }
      const actual = obs.value ? 'present' : 'absent';
      return obs.value === rule.expected
        ? { ...base, status: 'PASS', actual, reason: `${metric.label} is ${actual}, as required.` }
        : notSatisfied(actual, `is ${actual}, but the rule requires it ${expected}`);
    }

    case 'temporal': {
      if (typeof obs.value !== 'string') {
        return unknown(rule, expected, `${metric.label} was not a usable timestamp.`, obs);
      }
      const within = isWithinSession(obs.value, rule.window);
      if (within === null) {
        return unknown(rule, expected, `${metric.label} or the session window could not be parsed.`, obs);
      }
      const actual = obs.value;
      return within
        ? { ...base, status: 'PASS', actual, reason: `Entry falls inside the ${expected} session.` }
        : notSatisfied(actual, `falls outside the ${expected} session`);
    }

    case 'categorical': {
      if (typeof obs.value !== 'string') {
        return unknown(rule, expected, `${metric.label} was not a usable value.`, obs);
      }
      const inSet = rule.values.some((v) => v.toLowerCase() === (obs.value as string).toLowerCase());
      const satisfied = rule.operator === 'in' ? inSet : !inSet;
      return satisfied
        ? { ...base, status: 'PASS', actual: obs.value, reason: `${metric.label} is ${obs.value}, which satisfies the rule.` }
        : notSatisfied(obs.value, `is ${obs.value}, which does not satisfy ${expected}`);
    }
  }
}
