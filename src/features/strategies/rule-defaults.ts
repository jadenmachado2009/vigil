import type { Rule, SessionWindow } from '@/types/rules';
import type { MetricDef } from '@/types/metrics';
import { operatorLabel } from '@/lib/calculations/compare';

export const DEFAULT_SESSION: SessionWindow = {
  start: '09:30',
  end: '11:00',
  timezone: 'America/New_York',
};

export const TIMEZONES = [
  'America/New_York', 'Europe/London', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Europe/Zurich', 'UTC',
];

let counter = 0;
export function ruleId(): string {
  counter += 1;
  return `rule_${Date.now().toString(36)}_${counter}`;
}

/** Sensible starting point for a newly added condition. Everything is editable after. */
export function createRuleForMetric(metric: MetricDef): Rule {
  const base = { id: ruleId(), label: metric.label, mandatory: true, onFail: 'reject' as const, enabled: true };
  switch (metric.kind) {
    case 'boolean':
      return { ...base, kind: 'boolean', metric: metric.id, expected: true };
    case 'temporal':
      return { ...base, kind: 'temporal', metric: metric.id, window: { ...DEFAULT_SESSION } };
    case 'categorical':
      return { ...base, kind: 'categorical', metric: metric.id, operator: 'in', values: [] };
    case 'numeric':
      return {
        ...base,
        kind: 'numeric',
        metric: metric.id,
        operator: metric.preferred === 'lower' ? '<=' : '>=',
        value: 0,
        unit: metric.unit,
      };
  }
}

export function describeRule(rule: Rule): string {
  switch (rule.kind) {
    case 'numeric': {
      const suffix = rule.unit === 'percent' ? '%' : rule.unit === 'multiple' ? 'x' : '';
      return `${operatorLabel(rule.operator)} ${rule.value}${suffix}`;
    }
    case 'boolean':
      return rule.expected ? 'must be present' : 'must be absent';
    case 'temporal':
      return `${rule.window.start}–${rule.window.end} ${rule.window.timezone}`;
    case 'categorical':
      return `${rule.operator === 'in' ? 'one of' : 'not one of'} ${rule.values.join(', ') || '…'}`;
  }
}

/** A rule the user has not finished configuring. Blocks saving. */
export function ruleProblem(rule: Rule): string | null {
  if (rule.kind === 'numeric' && !Number.isFinite(rule.value)) return 'Needs a numeric threshold.';
  if (rule.kind === 'categorical' && rule.values.length === 0) return 'Needs at least one value.';
  if (rule.kind === 'temporal') {
    const clock = /^\d{1,2}:\d{2}$/;
    if (!clock.test(rule.window.start) || !clock.test(rule.window.end)) return 'Needs a valid HH:mm window.';
    if (rule.window.start === rule.window.end) return 'Start and end cannot be the same.';
  }
  return null;
}
