/**
 * Phrases that identify a metric.
 *
 * Longest match wins, so "revenue growth" is not swallowed by "revenue" and
 * "forward p/e" is not swallowed by "p/e".
 */
export const SYNONYMS: Record<string, string[]> = {
  // investing - growth
  revenue_cagr: ['revenue cagr', 'sales cagr', 'compound revenue growth'],
  revenue_growth: ['revenue growth', 'sales growth', 'top line growth', 'topline growth', 'revenue'],
  eps_cagr: ['eps cagr', 'earnings cagr'],
  eps_growth: ['eps growth', 'earnings growth', 'earnings per share growth', 'eps'],
  fcf_growth: ['fcf growth', 'free cash flow growth', 'cash flow growth'],

  // investing - profitability
  roic: ['roic', 'return on invested capital', 'return on capital'],
  roe: ['roe', 'return on equity'],
  gross_margin: ['gross margin', 'gross margins'],
  operating_margin: ['operating margin', 'operating margins', 'ebit margin'],
  net_margin: ['net margin', 'net margins', 'profit margin'],

  // investing - balance sheet
  // Bare "debt" is last so the longer, more specific phrases win the match.
  // It is here so "not much debt" asks for a threshold instead of vanishing.
  debt_ebitda: ['debt/ebitda', 'debt to ebitda', 'debt ebitda', 'net debt to ebitda', 'leverage', 'debt'],
  debt_equity: ['debt/equity', 'debt to equity', 'debt equity', 'gearing'],
  current_ratio: ['current ratio'],
  interest_coverage: ['interest coverage', 'interest cover'],

  // investing - cash flow
  fcf_margin: ['fcf margin', 'free cash flow margin'],
  fcf_positive: ['positive free cash flow', 'free cash flow positive', 'fcf positive', 'positive fcf', 'cash flow positive'],

  // investing - valuation
  forward_pe: ['forward pe', 'forward p/e', 'forward price to earnings', 'fwd pe'],
  peg: ['peg', 'peg ratio'],
  ev_ebitda: ['ev/ebitda', 'ev to ebitda', 'enterprise value to ebitda'],
  p_fcf: ['p/fcf', 'price to free cash flow', 'price to fcf'],
  ps: ['p/s', 'price to sales', 'ps ratio'],
  pe: ['pe ratio', 'p/e', 'pe', 'price to earnings'],

  // investing - qualitative
  moat: ['moat', 'competitive moat', 'competitive advantage', 'durable advantage', 'wide moat'],
  sector: ['sector', 'industry'],

  // trading - structure
  htf_fvg: ['htf fvg', 'higher timeframe fvg', 'htf fair value gap', 'higher timeframe fair value gap', 'htf gap'],
  ltf_fvg: ['ltf fvg', 'lower timeframe fvg', '5m fvg', '1m fvg', '15m fvg', 'entry timeframe fvg', 'ltf fair value gap'],
  inverse_fvg: ['inverse fvg', 'ifvg', 'inverted fair value gap', 'inversion'],
  liquidity_sweep: ['liquidity sweep', 'sweep', 'liquidity grab', 'stop hunt', 'raid'],
  bos: ['bos', 'break of structure', 'structure break'],
  choch: ['choch', 'change of character', 'character change'],
  liquidity_target: ['liquidity target', 'external liquidity', 'draw on liquidity', 'liquidity draw'],
  volume_above_average: ['volume above average', 'above average volume', 'high volume', 'volume confirmation'],
  candle_confirmation: ['candle confirmation', 'confirmation candle', 'closing candle'],
  price_above_ma: ['above the moving average', 'above ma', 'above the ma', 'price above moving average'],
  rsi: ['rsi', 'relative strength index'],

  // trading - risk
  rr: ['rr', 'risk reward', 'risk/reward', 'risk to reward', 'r:r', 'reward to risk'],
  risk_percent: ['risk per trade', 'account risk', 'risk percent', 'risk %'],
  entry_time: ['session', 'ny am', 'new york am', 'new york morning', 'ny morning', 'london morning', 'london session', 'new york session', 'asian session', 'killzone', 'kill zone'],
};

/** Named sessions, so "NY AM" becomes a real window instead of a question. */
export const SESSIONS: Record<string, { start: string; end: string; timezone: string; label: string }> = {
  'ny am': { start: '09:30', end: '11:00', timezone: 'America/New_York', label: 'New York AM' },
  'new york am': { start: '09:30', end: '11:00', timezone: 'America/New_York', label: 'New York AM' },
  'new york morning': { start: '09:30', end: '11:00', timezone: 'America/New_York', label: 'New York AM' },
  'ny morning': { start: '09:30', end: '11:00', timezone: 'America/New_York', label: 'New York AM' },
  'london morning': { start: '08:00', end: '11:00', timezone: 'Europe/London', label: 'London' },
  'new york session': { start: '09:30', end: '16:00', timezone: 'America/New_York', label: 'New York' },
  'london session': { start: '08:00', end: '11:00', timezone: 'Europe/London', label: 'London' },
  'asian session': { start: '00:00', end: '06:00', timezone: 'Asia/Tokyo', label: 'Asia' },
};

/** Comparators, longest first so "at least" beats "least". */
export const COMPARATORS: { phrases: string[]; operator: '>=' | '<=' | '>' | '<' }[] = [
  { phrases: ['greater than or equal to', 'at least', 'no less than', 'minimum of', 'minimum', 'min', 'at or above', 'above or equal'], operator: '>=' },
  { phrases: ['less than or equal to', 'at most', 'no more than', 'maximum of', 'maximum', 'max', 'under or equal', 'below or equal'], operator: '<=' },
  { phrases: ['greater than', 'more than', 'above', 'over', 'exceeding', 'exceeds', 'north of'], operator: '>' },
  { phrases: ['less than', 'lower than', 'below', 'under', 'beneath'], operator: '<' },
];

/** Words that mark a condition as nice-to-have rather than required. */
export const OPTIONAL_MARKERS = [
  'ideally', 'preferably', 'nice to have', 'bonus', 'if possible', 'optional',
  'would like', 'prefer', 'good to have',
];

export const NEGATIONS = ['no ', 'not ', 'without ', 'avoid ', 'never ', "don't ", 'dont '];
