import type { MetricDef } from '@/types/metrics.js';

/**
 * The single source of truth for what a rule may reference.
 * Adding a metric here makes it available to both strategy builders, the
 * natural-language parser, and the rules engine.
 */
const DEFS: MetricDef[] = [
  // ---------------------------------------------------------------- trading
  { id: 'entry', label: 'Entry price', kind: 'numeric', mode: 'trading', unit: 'price', origin: 'observed', group: 'levels', description: 'Planned entry price.' },
  { id: 'stop', label: 'Stop loss', kind: 'numeric', mode: 'trading', unit: 'price', origin: 'observed', group: 'levels', description: 'Planned stop-loss price.' },
  { id: 'target', label: 'Target', kind: 'numeric', mode: 'trading', unit: 'price', origin: 'observed', group: 'levels', description: 'Planned take-profit price.' },
  { id: 'direction', label: 'Direction', kind: 'categorical', mode: 'trading', unit: 'text', origin: 'observed', group: 'levels', description: 'Long or short.' },
  { id: 'instrument', label: 'Instrument', kind: 'categorical', mode: 'trading', unit: 'text', origin: 'observed', group: 'context', description: 'Ticker or pair.' },
  { id: 'entry_time', label: 'Entry time', kind: 'temporal', mode: 'trading', unit: 'time', origin: 'observed', group: 'session', description: 'Timestamp of the planned entry.' },

  { id: 'risk', label: 'Risk per unit', kind: 'numeric', mode: 'trading', unit: 'price', origin: 'computed', group: 'risk', description: 'Distance from entry to stop. Computed.' },
  { id: 'reward', label: 'Reward per unit', kind: 'numeric', mode: 'trading', unit: 'price', origin: 'computed', group: 'risk', description: 'Distance from entry to target. Computed.' },
  { id: 'rr', label: 'Risk/reward ratio', kind: 'numeric', mode: 'trading', unit: 'multiple', origin: 'computed', group: 'risk', description: 'Reward divided by risk. Computed, never supplied by a model.', preferred: 'higher' },
  { id: 'risk_percent', label: 'Account risk', kind: 'numeric', mode: 'trading', unit: 'percent', origin: 'observed', group: 'risk', description: 'Percent of account risked on the trade.', preferred: 'lower' },

  { id: 'htf_fvg', label: 'HTF fair value gap exists', kind: 'boolean', mode: 'trading', unit: 'boolean', origin: 'observed', group: 'entry', description: 'A fair value gap is present on the higher timeframe.' },
  { id: 'ltf_fvg', label: 'LTF fair value gap exists', kind: 'boolean', mode: 'trading', unit: 'boolean', origin: 'observed', group: 'entry', description: 'A fair value gap is present on the entry timeframe.' },
  { id: 'inverse_fvg', label: 'Inverse FVG confirmation', kind: 'boolean', mode: 'trading', unit: 'boolean', origin: 'observed', group: 'confirmation', description: 'Price has inverted a fair value gap.' },
  { id: 'liquidity_sweep', label: 'Liquidity sweep', kind: 'boolean', mode: 'trading', unit: 'boolean', origin: 'observed', group: 'entry', description: 'A prior high or low has been swept.' },
  { id: 'bos', label: 'Break of structure', kind: 'boolean', mode: 'trading', unit: 'boolean', origin: 'observed', group: 'entry', description: 'Market structure has broken in the trade direction.' },
  { id: 'choch', label: 'Change of character', kind: 'boolean', mode: 'trading', unit: 'boolean', origin: 'observed', group: 'entry', description: 'Structure has shifted against the prior trend.' },
  { id: 'liquidity_target', label: 'Liquidity target present', kind: 'boolean', mode: 'trading', unit: 'boolean', origin: 'observed', group: 'target', description: 'An identifiable pool of liquidity sits at the target.' },
  { id: 'volume_above_average', label: 'Volume above average', kind: 'boolean', mode: 'trading', unit: 'boolean', origin: 'observed', group: 'confirmation', description: 'Entry candle volume exceeds its moving average.' },
  { id: 'candle_confirmation', label: 'Candle confirmation', kind: 'boolean', mode: 'trading', unit: 'boolean', origin: 'observed', group: 'confirmation', description: 'A confirming candle has closed.' },
  { id: 'rsi', label: 'RSI', kind: 'numeric', mode: 'trading', unit: 'count', origin: 'observed', group: 'entry', description: 'Relative strength index at entry.' },
  { id: 'price_above_ma', label: 'Price above moving average', kind: 'boolean', mode: 'trading', unit: 'boolean', origin: 'observed', group: 'entry', description: 'Price trades above the configured moving average.' },

  // -------------------------------------------------------------- investing
  { id: 'revenue_growth', label: 'Revenue growth', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'observed', group: 'growth', description: 'Year-over-year revenue growth.', preferred: 'higher' },
  { id: 'revenue_cagr', label: 'Revenue CAGR', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'observed', group: 'growth', description: 'Compound annual revenue growth.', preferred: 'higher' },
  { id: 'eps_growth', label: 'EPS growth', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'observed', group: 'growth', description: 'Year-over-year earnings per share growth.', preferred: 'higher' },
  { id: 'eps_cagr', label: 'EPS CAGR', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'observed', group: 'growth', description: 'Compound annual EPS growth.', preferred: 'higher' },
  { id: 'fcf_growth', label: 'FCF growth', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'observed', group: 'growth', description: 'Free cash flow growth.', preferred: 'higher' },

  { id: 'roic', label: 'ROIC', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'observed', group: 'profitability', description: 'Return on invested capital.', preferred: 'higher' },
  { id: 'roe', label: 'ROE', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'observed', group: 'profitability', description: 'Return on equity.', preferred: 'higher' },
  { id: 'gross_margin', label: 'Gross margin', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'observed', group: 'profitability', description: 'Gross profit as a percent of revenue.', preferred: 'higher' },
  { id: 'operating_margin', label: 'Operating margin', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'observed', group: 'profitability', description: 'Operating income as a percent of revenue.', preferred: 'higher' },
  { id: 'net_margin', label: 'Net margin', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'observed', group: 'profitability', description: 'Net income as a percent of revenue.', preferred: 'higher' },

  { id: 'debt_equity', label: 'Debt / equity', kind: 'numeric', mode: 'investing', unit: 'multiple', origin: 'observed', group: 'balance-sheet', description: 'Total debt divided by shareholder equity.', preferred: 'lower' },
  { id: 'debt_ebitda', label: 'Debt / EBITDA', kind: 'numeric', mode: 'investing', unit: 'multiple', origin: 'observed', group: 'balance-sheet', description: 'Total debt divided by EBITDA.', preferred: 'lower' },
  { id: 'current_ratio', label: 'Current ratio', kind: 'numeric', mode: 'investing', unit: 'multiple', origin: 'observed', group: 'balance-sheet', description: 'Current assets over current liabilities.', preferred: 'higher' },
  { id: 'interest_coverage', label: 'Interest coverage', kind: 'numeric', mode: 'investing', unit: 'multiple', origin: 'observed', group: 'balance-sheet', description: 'EBIT over interest expense.', preferred: 'higher' },

  { id: 'fcf', label: 'Free cash flow', kind: 'numeric', mode: 'investing', unit: 'currency', origin: 'observed', group: 'cash-flow', description: 'Trailing twelve month free cash flow.' },
  { id: 'revenue', label: 'Revenue', kind: 'numeric', mode: 'investing', unit: 'currency', origin: 'observed', group: 'cash-flow', description: 'Trailing twelve month revenue.' },
  { id: 'fcf_positive', label: 'Free cash flow positive', kind: 'boolean', mode: 'investing', unit: 'boolean', origin: 'computed', group: 'cash-flow', description: 'Whether free cash flow is above zero. Computed from FCF.' },
  { id: 'fcf_margin', label: 'FCF margin', kind: 'numeric', mode: 'investing', unit: 'percent', origin: 'computed', group: 'cash-flow', description: 'Free cash flow as a percent of revenue. Computed.', preferred: 'higher' },

  { id: 'pe', label: 'P/E', kind: 'numeric', mode: 'investing', unit: 'multiple', origin: 'observed', group: 'valuation', description: 'Trailing price to earnings.', preferred: 'lower' },
  { id: 'forward_pe', label: 'Forward P/E', kind: 'numeric', mode: 'investing', unit: 'multiple', origin: 'observed', group: 'valuation', description: 'Forward price to earnings.', preferred: 'lower' },
  { id: 'peg', label: 'PEG', kind: 'numeric', mode: 'investing', unit: 'multiple', origin: 'computed', group: 'valuation', description: 'P/E divided by EPS growth. Computed.', preferred: 'lower' },
  { id: 'ev_ebitda', label: 'EV / EBITDA', kind: 'numeric', mode: 'investing', unit: 'multiple', origin: 'observed', group: 'valuation', description: 'Enterprise value over EBITDA.', preferred: 'lower' },
  { id: 'ps', label: 'P/S', kind: 'numeric', mode: 'investing', unit: 'multiple', origin: 'observed', group: 'valuation', description: 'Price to sales.', preferred: 'lower' },
  { id: 'p_fcf', label: 'P/FCF', kind: 'numeric', mode: 'investing', unit: 'multiple', origin: 'observed', group: 'valuation', description: 'Price to free cash flow.', preferred: 'lower' },

  { id: 'moat', label: 'Competitive moat', kind: 'boolean', mode: 'investing', unit: 'boolean', origin: 'observed', group: 'qualitative', description: 'A durable competitive advantage is present.' },
  { id: 'management_quality', label: 'Management quality', kind: 'categorical', mode: 'investing', unit: 'text', origin: 'observed', group: 'qualitative', description: 'Assessed quality of management.' },
  { id: 'sector', label: 'Sector', kind: 'categorical', mode: 'investing', unit: 'text', origin: 'observed', group: 'context', description: 'GICS sector.' },
];

const BY_ID = new Map(DEFS.map((d) => [d.id, d]));

export const METRICS: readonly MetricDef[] = DEFS;

export function getMetric(id: string): MetricDef | undefined {
  return BY_ID.get(id);
}

export function metricsForMode(mode: 'trading' | 'investing'): MetricDef[] {
  return DEFS.filter((d) => d.mode === mode || d.mode === 'both');
}

export function isComputedMetric(id: string): boolean {
  return BY_ID.get(id)?.origin === 'computed';
}

export const COMPUTED_METRIC_IDS: readonly string[] = DEFS.filter(
  (d) => d.origin === 'computed',
).map((d) => d.id);
