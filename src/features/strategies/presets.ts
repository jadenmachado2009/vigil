import type { CreateStrategyInput } from '@/lib/repository/types';
import { ruleId, DEFAULT_SESSION } from './rule-defaults';

const req = { mandatory: true, onFail: 'reject' as const, enabled: true };
const opt = { mandatory: false, onFail: 'reject' as const, enabled: true };

/**
 * The two seed strategies from the original prototype, now expressed as
 * structured rules. Offered as starting points, never applied silently.
 */
export function nyAmFvgPreset(): CreateStrategyInput {
  return {
    name: 'NY AM FVG',
    mode: 'trading',
    description: 'Fair value gap continuation during the New York morning session.',
    meta: { market: 'forex', htfTimeframe: '1H', entryTimeframe: '5M', stopMethod: 'structure', targetMethod: 'liquidity', positionSizing: 'fixed-percent' },
    rules: [
      { ...req, id: ruleId(), kind: 'boolean', metric: 'htf_fvg', expected: true, label: 'HTF FVG exists' },
      { ...req, id: ruleId(), kind: 'boolean', metric: 'ltf_fvg', expected: true, label: '5M FVG exists' },
      { ...req, id: ruleId(), kind: 'boolean', metric: 'inverse_fvg', expected: true, label: 'Inverse FVG confirmation' },
      { ...req, id: ruleId(), kind: 'temporal', metric: 'entry_time', window: { ...DEFAULT_SESSION }, label: 'NY AM session' },
      { ...req, id: ruleId(), kind: 'numeric', metric: 'rr', operator: '>=', value: 2, unit: 'multiple', label: 'Minimum RR 2.0' },
      { ...opt, id: ruleId(), kind: 'boolean', metric: 'liquidity_target', expected: true, label: 'External liquidity target' },
    ],
  };
}

export function qualityGrowthPreset(): CreateStrategyInput {
  return {
    name: 'Quality Growth',
    mode: 'investing',
    description: 'Profitable compounders at a defensible valuation.',
    meta: { holdingPeriod: '3–5 years' },
    rules: [
      { ...req, id: ruleId(), kind: 'numeric', metric: 'revenue_growth', operator: '>=', value: 15, unit: 'percent', label: 'Revenue growth ≥ 15%' },
      { ...req, id: ruleId(), kind: 'numeric', metric: 'eps_growth', operator: '>=', value: 15, unit: 'percent', label: 'EPS growth ≥ 15%' },
      { ...req, id: ruleId(), kind: 'numeric', metric: 'roic', operator: '>=', value: 15, unit: 'percent', label: 'ROIC ≥ 15%' },
      { ...req, id: ruleId(), kind: 'numeric', metric: 'debt_ebitda', operator: '<=', value: 2, unit: 'multiple', label: 'Debt/EBITDA ≤ 2' },
      { ...req, id: ruleId(), kind: 'boolean', metric: 'fcf_positive', expected: true, label: 'Free cash flow positive' },
      { ...req, id: ruleId(), kind: 'numeric', metric: 'forward_pe', operator: '<=', value: 35, unit: 'multiple', label: 'Forward P/E ≤ 35', onFail: 'watch' },
      { ...opt, id: ruleId(), kind: 'boolean', metric: 'moat', expected: true, label: 'Strong competitive moat' },
    ],
  };
}
