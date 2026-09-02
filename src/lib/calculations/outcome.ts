import type { Direction } from './trading';

/**
 * Outcome arithmetic.
 *
 * The R multiple is DERIVED from entry, stop and exit — never typed in. A
 * self-reported "that was a 3R" is exactly the kind of number that flatters a
 * journal into uselessness, and it is the one figure every downstream statistic
 * depends on.
 */

export type TradeStatus = 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN' | 'NOT_TAKEN';
export type InvestmentStatus = 'NOT_BOUGHT' | 'BOUGHT' | 'HOLDING' | 'SOLD';

/** Below this, a result is flat rather than a win or a loss. */
export const BREAKEVEN_BAND = 0.05;

export interface RMultipleInput {
  entry: number | null;
  stop: number | null;
  exit: number | null;
  direction?: Direction | null;
}

/**
 * Risk multiples: how many units of the risk taken were returned.
 * A long stopped out exactly returns −1R by construction.
 */
export function computeRMultiple(input: RMultipleInput): number | null {
  const { entry, stop, exit } = input;
  if (entry === null || stop === null || exit === null) return null;
  if (![entry, stop, exit].every(Number.isFinite)) return null;

  const risk = Math.abs(entry - stop);
  if (risk === 0) return null;

  const direction = input.direction ?? (stop < entry ? 'long' : 'short');
  const move = direction === 'long' ? exit - entry : entry - exit;
  return move / risk;
}

/**
 * Suggests a status from the arithmetic. Offered to the user, never forced:
 * a trade closed early for a reason the numbers cannot see is still their call.
 */
export function classifyOutcome(rMultiple: number | null): TradeStatus | null {
  if (rMultiple === null) return null;
  if (rMultiple > BREAKEVEN_BAND) return 'WIN';
  if (rMultiple < -BREAKEVEN_BAND) return 'LOSS';
  return 'BREAKEVEN';
}

/** Percentage return on an investment. */
export function computeReturnPercent(buy: number | null, sell: number | null): number | null {
  if (buy === null || sell === null) return null;
  if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy === 0) return null;
  return ((sell - buy) / Math.abs(buy)) * 100;
}

/** Statuses that represent a position that actually happened. */
export function wasTaken(status: TradeStatus): boolean {
  return status === 'WIN' || status === 'LOSS' || status === 'BREAKEVEN' || status === 'OPEN';
}

/** Statuses whose R multiple is settled and can enter performance statistics. */
export function isClosed(status: TradeStatus): boolean {
  return status === 'WIN' || status === 'LOSS' || status === 'BREAKEVEN';
}
