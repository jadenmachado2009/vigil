import { describe, it, expect } from 'vitest';
import {
  computeRMultiple, classifyOutcome, computeReturnPercent, wasTaken, isClosed,
} from '@/lib/calculations/outcome';

describe('R multiple', () => {
  it('a long stopped out returns exactly -1R', () => {
    expect(computeRMultiple({ entry: 100, stop: 98, exit: 98 })).toBeCloseTo(-1, 10);
  });

  it('a long hitting a 2R target returns 2R', () => {
    // risk 2, target 104 is 4 away
    expect(computeRMultiple({ entry: 100, stop: 98, exit: 104 })).toBeCloseTo(2, 10);
  });

  it('handles shorts by direction, not absolute value', () => {
    // short from 100, stop 102 (risk 2), covered at 96 -> +2R
    expect(computeRMultiple({ entry: 100, stop: 102, exit: 96 })).toBeCloseTo(2, 10);
    // same short, stopped out -> -1R
    expect(computeRMultiple({ entry: 100, stop: 102, exit: 102 })).toBeCloseTo(-1, 10);
  });

  it('infers direction from stop placement when not stated', () => {
    expect(computeRMultiple({ entry: 100, stop: 98, exit: 103 })).toBeCloseTo(1.5, 10);
    expect(computeRMultiple({ entry: 100, stop: 102, exit: 97 })).toBeCloseTo(1.5, 10);
  });

  it('respects an explicit direction over the inferred one', () => {
    // Levels look long, but the trader says short: the sign must follow them.
    expect(computeRMultiple({ entry: 100, stop: 98, exit: 104, direction: 'short' })).toBeCloseTo(-2, 10);
  });

  it('computes a partial exit correctly', () => {
    // risk 0.0032, exited at 1.1668 from 1.1642
    expect(computeRMultiple({ entry: 1.1642, stop: 1.1610, exit: 1.1668 })).toBeCloseTo(0.8125, 4);
  });

  it('returns null rather than a number when anything is missing', () => {
    expect(computeRMultiple({ entry: 100, stop: 98, exit: null })).toBeNull();
    expect(computeRMultiple({ entry: null, stop: 98, exit: 104 })).toBeNull();
    expect(computeRMultiple({ entry: 100, stop: null, exit: 104 })).toBeNull();
  });

  it('refuses zero risk instead of dividing by zero', () => {
    expect(computeRMultiple({ entry: 100, stop: 100, exit: 104 })).toBeNull();
  });

  it('rejects non-finite input', () => {
    expect(computeRMultiple({ entry: NaN, stop: 98, exit: 104 })).toBeNull();
    expect(computeRMultiple({ entry: 100, stop: 98, exit: Infinity })).toBeNull();
  });
});

describe('classifying a result', () => {
  it('calls a clear gain a win and a clear loss a loss', () => {
    expect(classifyOutcome(2)).toBe('WIN');
    expect(classifyOutcome(-1)).toBe('LOSS');
  });

  it('treats a near-flat result as breakeven rather than a rounding-error win', () => {
    expect(classifyOutcome(0)).toBe('BREAKEVEN');
    expect(classifyOutcome(0.02)).toBe('BREAKEVEN');
    expect(classifyOutcome(-0.04)).toBe('BREAKEVEN');
    expect(classifyOutcome(0.06)).toBe('WIN');
  });

  it('suggests nothing when there is no R multiple', () => {
    expect(classifyOutcome(null)).toBeNull();
  });
});

describe('investment return', () => {
  it('computes a percentage gain and loss', () => {
    expect(computeReturnPercent(100, 130)).toBeCloseTo(30, 10);
    expect(computeReturnPercent(100, 80)).toBeCloseTo(-20, 10);
  });
  it('refuses a zero or missing basis', () => {
    expect(computeReturnPercent(0, 130)).toBeNull();
    expect(computeReturnPercent(null, 130)).toBeNull();
    expect(computeReturnPercent(100, null)).toBeNull();
  });
});

describe('status predicates', () => {
  it('knows which statuses mean a position existed', () => {
    expect(wasTaken('WIN')).toBe(true);
    expect(wasTaken('OPEN')).toBe(true);
    expect(wasTaken('NOT_TAKEN')).toBe(false);
  });
  it('knows which statuses have a settled R multiple', () => {
    expect(isClosed('WIN')).toBe(true);
    expect(isClosed('BREAKEVEN')).toBe(true);
    expect(isClosed('OPEN')).toBe(false);
    expect(isClosed('NOT_TAKEN')).toBe(false);
  });
});
