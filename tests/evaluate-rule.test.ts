import { describe, it, expect } from 'vitest';
import { evaluateRule } from '@/lib/rules-engine/evaluate-rule';
import type { Rule } from '@/types/rules';
import type { ObservationSet } from '@/types/observations';
import { NOW } from './fixtures/strategies';

const base = { id: 'x', label: 'Test rule', mandatory: true, onFail: 'reject' as const, enabled: true };
const roicRule: Rule = { ...base, kind: 'numeric', metric: 'roic', operator: '>=', value: 15, unit: 'percent' };
const fvgRule: Rule = { ...base, kind: 'boolean', metric: 'inverse_fvg', expected: true };
const opts = { now: NOW };

function set(o: ObservationSet): ObservationSet { return o; }

describe('numeric rules', () => {
  it('passes above the threshold and fails below it', () => {
    expect(evaluateRule(roicRule, set({ roic: { value: 20, source: 'financial-api', asOf: NOW } }), opts).status).toBe('PASS');
    expect(evaluateRule(roicRule, set({ roic: { value: 12, source: 'financial-api', asOf: NOW } }), opts).status).toBe('FAIL');
  });

  it('normalises a ratio observation against a percent rule', () => {
    const result = evaluateRule(roicRule, set({ roic: { value: 0.42, unit: 'ratio', source: 'financial-api', asOf: NOW } }), opts);
    expect(result.status).toBe('PASS');
    expect(result.actual).toBe('42%');
  });

  it('reports the observed value and threshold in plain language', () => {
    const result = evaluateRule(roicRule, set({ roic: { value: 12, source: 'financial-api', asOf: NOW } }), opts);
    expect(result.actual).toBe('12%');
    expect(result.expected).toBe('≥ 15%');
    expect(result.reason).toContain('does not satisfy');
  });
});

describe('missing and unusable data', () => {
  it('UNKNOWN when the metric was never reported', () => {
    const result = evaluateRule(roicRule, set({}), opts);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toMatch(/not assumed to pass/);
  });

  it('UNKNOWN when the value is explicitly null', () => {
    expect(evaluateRule(roicRule, set({ roic: { value: null, source: 'financial-api', asOf: NOW } }), opts).status).toBe('UNKNOWN');
  });

  it('UNKNOWN, not FAIL, when the rule references an unknown metric', () => {
    const bogus: Rule = { ...base, kind: 'numeric', metric: 'vibes', operator: '>=', value: 1, unit: 'count' };
    expect(evaluateRule(bogus, set({ vibes: { value: 0, source: 'user', asOf: NOW } }), opts).status).toBe('UNKNOWN');
  });

  it('UNKNOWN when the value has the wrong type', () => {
    expect(evaluateRule(roicRule, set({ roic: { value: 'lots', source: 'user', asOf: NOW } }), opts).status).toBe('UNKNOWN');
  });

  it('UNKNOWN when confidence is below the floor', () => {
    const result = evaluateRule(
      fvgRule,
      set({ inverse_fvg: { value: true, source: 'vision', asOf: NOW, confidence: 0.3 } }),
      { now: NOW, minConfidence: 0.6 },
    );
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toMatch(/low confidence/);
  });

  it('UNKNOWN and flagged stale when the observation is past its freshness budget', () => {
    const result = evaluateRule(
      roicRule,
      set({ roic: { value: 42, source: 'financial-api', asOf: '2024-01-01T00:00:00.000Z' } }),
      { now: NOW, maxAgeDays: 120 },
    );
    expect(result.status).toBe('UNKNOWN');
    expect(result.stale).toBe(true);
  });
});

describe('pending observations', () => {
  it('UNCONFIRMED rather than FAIL when the observer flagged the fact as unresolved', () => {
    const result = evaluateRule(
      fvgRule,
      set({ inverse_fvg: { value: false, source: 'vision', asOf: NOW, pending: true } }),
      opts,
    );
    expect(result.status).toBe('UNCONFIRMED');
    expect(result.reason).toMatch(/not been confirmed yet/);
  });

  it('FAIL when the same fact is definitively absent', () => {
    expect(evaluateRule(fvgRule, set({ inverse_fvg: { value: false, source: 'vision', asOf: NOW } }), opts).status).toBe('FAIL');
  });
});

describe('temporal and categorical rules', () => {
  const sessionRule: Rule = {
    ...base, kind: 'temporal', metric: 'entry_time',
    window: { start: '09:30', end: '11:00', timezone: 'America/New_York' },
  };

  it('passes inside the session and fails outside it', () => {
    expect(evaluateRule(sessionRule, set({ entry_time: { value: '2026-03-10T14:30:00.000Z', source: 'user', asOf: NOW } }), opts).status).toBe('PASS');
    expect(evaluateRule(sessionRule, set({ entry_time: { value: '2026-03-10T18:30:00.000Z', source: 'user', asOf: NOW } }), opts).status).toBe('FAIL');
  });

  it('excludes a sector with a categorical rule', () => {
    const rule: Rule = { ...base, kind: 'categorical', metric: 'sector', operator: 'not_in', values: ['Energy', 'Utilities'] };
    expect(evaluateRule(rule, set({ sector: { value: 'Technology', source: 'financial-api', asOf: NOW } }), opts).status).toBe('PASS');
    expect(evaluateRule(rule, set({ sector: { value: 'energy', source: 'financial-api', asOf: NOW } }), opts).status).toBe('FAIL');
  });
});

describe('session rules report time in the session zone', () => {
  const sessionRule: Rule = {
    ...base, kind: 'temporal', metric: 'entry_time',
    window: { start: '09:30', end: '11:00', timezone: 'America/New_York' },
  };

  it('shows the wall-clock time in the rule timezone, not the raw timestamp', () => {
    // 18:45 UTC is 14:45 in New York during DST - outside the morning window.
    const result = evaluateRule(
      sessionRule,
      set({ entry_time: { value: '2026-03-10T18:45:00.000Z', source: 'user', asOf: NOW } }),
      opts,
    );
    expect(result.status).toBe('FAIL');
    expect(result.actual).toBe('14:45');
    expect(result.expected).toBe('09:30–11:00');
    expect(result.reason).toContain('New York');
  });

  it('keeps the threshold column free of the timezone so columns cannot collide', () => {
    expect(sessionRule.kind).toBe('temporal');
    const result = evaluateRule(
      sessionRule,
      set({ entry_time: { value: '2026-03-10T14:45:00.000Z', source: 'user', asOf: NOW } }),
      opts,
    );
    expect(result.expected).not.toContain('America');
    expect(result.actual).toBe('10:45');
    expect(result.status).toBe('PASS');
  });
});
