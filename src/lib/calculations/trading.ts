/**
 * Trade geometry. Every number here is derived by code from raw price levels.
 * A vision model reports entry / stop / target; it is never asked for the RR,
 * and never asked whether the RR is acceptable. Spec section 6.
 */

export type Direction = 'long' | 'short';

export interface TradeGeometryInput {
  entry: number | null;
  stop: number | null;
  target: number | null;
  direction?: Direction | null;
}

export interface TradeGeometry {
  direction: Direction | null;
  risk: number | null;
  reward: number | null;
  rr: number | null;
  /** Set when the levels are internally inconsistent. */
  invalidReason?: string;
}

/** Infer direction from the geometry when the observer did not state it. */
export function inferDirection(entry: number, stop: number): Direction | null {
  if (stop < entry) return 'long';
  if (stop > entry) return 'short';
  return null;
}

/**
 * Returns nulls rather than throwing when inputs are missing, so that a missing
 * price level surfaces as INSUFFICIENT DATA instead of a fabricated ratio.
 */
export function computeTradeGeometry(input: TradeGeometryInput): TradeGeometry {
  const { entry, stop, target } = input;
  const empty: TradeGeometry = { direction: null, risk: null, reward: null, rr: null };

  if (entry === null || stop === null || target === null) {
    return { ...empty, invalidReason: 'One or more price levels were not provided.' };
  }
  if (![entry, stop, target].every(Number.isFinite)) {
    return { ...empty, invalidReason: 'Price levels must be finite numbers.' };
  }

  const direction = input.direction ?? inferDirection(entry, stop);
  if (direction === null) {
    return { ...empty, invalidReason: 'Stop equals entry, so risk is zero.' };
  }

  // Reject geometry that contradicts the stated direction rather than taking
  // absolute values and producing a plausible-looking but meaningless ratio.
  if (direction === 'long' && !(stop < entry && target > entry)) {
    return {
      ...empty,
      direction,
      invalidReason: 'For a long, stop must be below entry and target above entry.',
    };
  }
  if (direction === 'short' && !(stop > entry && target < entry)) {
    return {
      ...empty,
      direction,
      invalidReason: 'For a short, stop must be above entry and target below entry.',
    };
  }

  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  if (risk === 0) {
    return { ...empty, direction, invalidReason: 'Stop equals entry, so risk is zero.' };
  }

  return { direction, risk, reward, rr: reward / risk };
}

export interface PositionSizeInput {
  accountSize: number;
  riskPercent: number;
  entry: number;
  stop: number;
}

/** Units of the instrument to trade so that a stop-out costs exactly riskPercent. */
export function computePositionSize(input: PositionSizeInput): number | null {
  const { accountSize, riskPercent, entry, stop } = input;
  const perUnitRisk = Math.abs(entry - stop);
  if (perUnitRisk === 0 || accountSize <= 0 || riskPercent <= 0) return null;
  return (accountSize * (riskPercent / 100)) / perUnitRisk;
}
