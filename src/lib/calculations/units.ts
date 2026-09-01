import type { Unit } from '@/types/metrics';

/**
 * Tolerance for float comparison. 0.1 + 0.2 >= 0.3 must be true, and a revenue
 * growth of 14.999999999 must not pass a ">= 15" rule by accident of encoding.
 */
export const EPSILON = 1e-9;

export class UnitMismatchError extends Error {
  constructor(from: Unit, to: Unit) {
    super(`Cannot convert ${from} to ${to}`);
    this.name = 'UnitMismatchError';
  }
}

/** Convert a numeric value between compatible units. Throws when incompatible. */
export function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  if (from === 'percent' && to === 'ratio') return value / 100;
  if (from === 'ratio' && to === 'percent') return value * 100;
  // `multiple` and `ratio` are the same shape but carry different meaning
  // (2.0x vs 0.15). Converting between them silently would be a real bug, so
  // it is refused rather than guessed.
  throw new UnitMismatchError(from, to);
}

export function areUnitsCompatible(from: Unit, to: Unit): boolean {
  try {
    convert(1, from, to);
    return true;
  } catch {
    return false;
  }
}
