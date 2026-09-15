/**
 * Discounted cash flow.
 *
 * Every input is the user's assumption. Vigil does the arithmetic and shows
 * the working; it does not choose a growth rate, a discount rate, or decide
 * whether the result is attractive. A DCF is only as good as its assumptions,
 * and the point of showing it is to make those assumptions explicit.
 */

export interface DcfInput {
  /** Free cash flow in the most recent year, in currency units. */
  freeCashFlow: number;
  /** Annual growth applied during the explicit forecast, percent. */
  growthPercent: number;
  /** Growth assumed forever after the forecast, percent. Must be below the discount rate. */
  terminalGrowthPercent: number;
  /** Required return, percent. */
  discountPercent: number;
  /** Explicit forecast length, whole years, 1–30. */
  years: number;
  /** Shares outstanding, for a per-share figure. */
  sharesOutstanding: number;
  /** Cash minus debt. Negative when the company owes more than it holds. */
  netCash?: number;
  /** Current share price, for the implied difference. */
  price?: number | null;
}

export interface DcfResult {
  /** Each forecast year's cash flow and its present value. */
  years: { year: number; cashFlow: number; presentValue: number }[];
  presentValueOfForecast: number;
  terminalValue: number;
  presentValueOfTerminal: number;
  enterpriseValue: number;
  equityValue: number;
  perShare: number;
  /** (perShare − price) ÷ price, percent. Null without a price. */
  impliedDifferencePercent: number | null;
  /** How much of the value sits in the terminal — the part least supported by evidence. */
  terminalShare: number;
}

export type DcfProblem =
  | 'terminal_growth_not_below_discount'
  | 'non_positive_shares'
  | 'years_out_of_range'
  | 'non_finite_input';

/**
 * Returns a problem rather than a number when the model is undefined. The
 * Gordon growth formula divides by (discount − terminal growth): at or below
 * zero it produces infinite or negative value, which is a broken assumption,
 * not a finding.
 */
export function validateDcf(input: DcfInput): DcfProblem | null {
  const numbers = [
    input.freeCashFlow, input.growthPercent, input.terminalGrowthPercent,
    input.discountPercent, input.years, input.sharesOutstanding, input.netCash ?? 0,
  ];
  if (!numbers.every(Number.isFinite)) return 'non_finite_input';
  if (input.sharesOutstanding <= 0) return 'non_positive_shares';
  if (!Number.isInteger(input.years) || input.years < 1 || input.years > 30) return 'years_out_of_range';
  if (input.discountPercent <= input.terminalGrowthPercent) return 'terminal_growth_not_below_discount';
  return null;
}

export function computeDcf(input: DcfInput): DcfResult | { problem: DcfProblem } {
  const problem = validateDcf(input);
  if (problem) return { problem };

  const g = input.growthPercent / 100;
  const tg = input.terminalGrowthPercent / 100;
  const r = input.discountPercent / 100;

  const years: DcfResult['years'] = [];
  let cashFlow = input.freeCashFlow;
  let presentValueOfForecast = 0;
  for (let year = 1; year <= input.years; year += 1) {
    cashFlow *= 1 + g;
    const presentValue = cashFlow / (1 + r) ** year;
    presentValueOfForecast += presentValue;
    years.push({ year, cashFlow, presentValue });
  }

  // Gordon growth on the year after the forecast, discounted back.
  const terminalValue = (cashFlow * (1 + tg)) / (r - tg);
  const presentValueOfTerminal = terminalValue / (1 + r) ** input.years;

  const enterpriseValue = presentValueOfForecast + presentValueOfTerminal;
  const equityValue = enterpriseValue + (input.netCash ?? 0);
  const perShare = equityValue / input.sharesOutstanding;

  const price = input.price ?? null;
  const impliedDifferencePercent =
    price !== null && Number.isFinite(price) && price > 0 ? ((perShare - price) / price) * 100 : null;

  return {
    years,
    presentValueOfForecast,
    terminalValue,
    presentValueOfTerminal,
    enterpriseValue,
    equityValue,
    perShare,
    impliedDifferencePercent,
    terminalShare: enterpriseValue === 0 ? 0 : (presentValueOfTerminal / enterpriseValue) * 100,
  };
}
