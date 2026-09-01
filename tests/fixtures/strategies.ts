import type { StrategyVersion, Rule } from '@/types/rules.js';

const base = { mandatory: true, onFail: 'reject' as const, enabled: true };

/** The seed strategy from the original MVP, expressed as structured rules. */
export const nyAmFvg: StrategyVersion = {
  id: 'sv_trading_1',
  strategyId: 's_trading',
  version: 1,
  mode: 'trading',
  createdAt: '2026-01-01T00:00:00.000Z',
  rules: [
    { ...base, id: 'r1', kind: 'boolean', metric: 'htf_fvg', expected: true, label: 'HTF FVG exists' },
    { ...base, id: 'r2', kind: 'boolean', metric: 'ltf_fvg', expected: true, label: '5M FVG exists' },
    { ...base, id: 'r3', kind: 'boolean', metric: 'inverse_fvg', expected: true, label: 'Inverse FVG confirmation' },
    {
      ...base, id: 'r4', kind: 'temporal', metric: 'entry_time', label: 'NY AM session',
      window: { start: '09:30', end: '11:00', timezone: 'America/New_York' },
    },
    { ...base, id: 'r5', kind: 'numeric', metric: 'rr', operator: '>=', value: 2, unit: 'multiple', label: 'Minimum RR 2.0' },
    { ...base, id: 'r6', kind: 'boolean', metric: 'liquidity_target', expected: true, label: 'External liquidity target', mandatory: false },
  ] satisfies Rule[],
};

/** The seed investing strategy, with the valuation rule set to WATCH per spec section 8. */
export const qualityGrowth: StrategyVersion = {
  id: 'sv_investing_1',
  strategyId: 's_investing',
  version: 1,
  mode: 'investing',
  createdAt: '2026-01-01T00:00:00.000Z',
  rules: [
    { ...base, id: 'i1', kind: 'numeric', metric: 'revenue_growth', operator: '>=', value: 15, unit: 'percent', label: 'Revenue growth ≥ 15%' },
    { ...base, id: 'i2', kind: 'numeric', metric: 'eps_growth', operator: '>=', value: 15, unit: 'percent', label: 'EPS growth ≥ 15%' },
    { ...base, id: 'i3', kind: 'numeric', metric: 'roic', operator: '>=', value: 15, unit: 'percent', label: 'ROIC ≥ 15%' },
    { ...base, id: 'i4', kind: 'numeric', metric: 'debt_ebitda', operator: '<=', value: 2, unit: 'multiple', label: 'Debt/EBITDA ≤ 2' },
    { ...base, id: 'i5', kind: 'boolean', metric: 'fcf_positive', expected: true, label: 'Free cash flow positive' },
    { ...base, id: 'i6', kind: 'numeric', metric: 'forward_pe', operator: '<=', value: 35, unit: 'multiple', label: 'Forward P/E ≤ 35', onFail: 'watch' },
    { ...base, id: 'i7', kind: 'boolean', metric: 'moat', expected: true, label: 'Strong competitive moat', mandatory: false },
  ] satisfies Rule[],
};

export const NOW = '2026-03-10T15:00:00.000Z';

/** Helper: build an observation set from plain values, all sourced and current. */
export function obs(
  values: Record<string, number | boolean | string | null>,
  overrides: Record<string, Partial<import('@/types/observations.js').Observation>> = {},
  asOf = NOW,
): import('@/types/observations.js').ObservationSet {
  const set: import('@/types/observations.js').ObservationSet = {};
  for (const [key, value] of Object.entries(values)) {
    set[key] = { value, source: 'mock', asOf, ...(overrides[key] ?? {}) };
  }
  return set;
}
