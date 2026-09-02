import { describe, it, expect } from 'vitest';
import { computeTradeGeometry, computePositionSize, inferDirection } from '@/lib/calculations/trading';
import { compareNumbers } from '@/lib/calculations/compare';
import { convert, areUnitsCompatible } from '@/lib/calculations/units';
import { isWithinSession, parseClock, minutesInTimezone } from '@/lib/calculations/time';

describe('trade geometry', () => {
  it('computes RR for the spec long example', () => {
    // entry 1.1642, stop 1.1610, target 1.1700
    const g = computeTradeGeometry({ entry: 1.1642, stop: 1.1610, target: 1.1700 });
    expect(g.direction).toBe('long');
    expect(g.risk).toBeCloseTo(0.0032, 10);
    expect(g.reward).toBeCloseTo(0.0058, 10);
    expect(g.rr).toBeCloseTo(1.8125, 4);
  });

  it('computes RR for a short', () => {
    const g = computeTradeGeometry({ entry: 100, stop: 110, target: 80 });
    expect(g.direction).toBe('short');
    expect(g.rr).toBeCloseTo(2, 10);
  });

  it('returns null rather than a ratio when a level is missing', () => {
    expect(computeTradeGeometry({ entry: 100, stop: null, target: 120 }).rr).toBeNull();
  });

  it('refuses geometry that contradicts the stated direction', () => {
    const g = computeTradeGeometry({ entry: 100, stop: 90, target: 80, direction: 'long' });
    expect(g.rr).toBeNull();
    expect(g.invalidReason).toMatch(/target above entry/);
  });

  it('refuses zero risk instead of dividing by zero', () => {
    const g = computeTradeGeometry({ entry: 100, stop: 100, target: 120 });
    expect(g.rr).toBeNull();
    expect(Number.isFinite(g.rr as number)).toBe(false);
  });

  it('rejects non-finite input', () => {
    expect(computeTradeGeometry({ entry: NaN, stop: 1, target: 2 }).rr).toBeNull();
  });

  it('infers direction from stop placement', () => {
    expect(inferDirection(100, 90)).toBe('long');
    expect(inferDirection(100, 110)).toBe('short');
    expect(inferDirection(100, 100)).toBeNull();
  });
});

describe('position sizing', () => {
  it('sizes so a stop-out costs exactly the risk budget', () => {
    // 10,000 account, 1% risk, 2.00 per-unit risk -> 50 units
    expect(computePositionSize({ accountSize: 10_000, riskPercent: 1, entry: 100, stop: 98 })).toBe(50);
  });
  it('returns null when the stop is at the entry', () => {
    expect(computePositionSize({ accountSize: 10_000, riskPercent: 1, entry: 100, stop: 100 })).toBeNull();
  });
});

describe('epsilon-aware comparison', () => {
  it('handles the spec RR cases', () => {
    expect(compareNumbers(2.5, '>=', 2)).toBe(true);
    expect(compareNumbers(1.8, '>=', 2)).toBe(false);
  });
  it('handles the spec growth cases', () => {
    expect(compareNumbers(20, '>=', 15)).toBe(true);
    expect(compareNumbers(12, '>=', 15)).toBe(false);
  });
  it('does not let float representation flip a boundary', () => {
    expect(compareNumbers(0.1 + 0.2, '>=', 0.3)).toBe(true);
    expect(compareNumbers(0.1 + 0.2, '<=', 0.3)).toBe(true);
    expect(compareNumbers(0.1 + 0.2, '==', 0.3)).toBe(true);
  });
  it('treats an exact boundary as satisfying >= and <=', () => {
    expect(compareNumbers(2, '>=', 2)).toBe(true);
    expect(compareNumbers(2, '<=', 2)).toBe(true);
    expect(compareNumbers(2, '>', 2)).toBe(false);
  });
});

describe('units', () => {
  it('converts percent and ratio', () => {
    expect(convert(15, 'percent', 'ratio')).toBeCloseTo(0.15, 10);
    expect(convert(0.284, 'ratio', 'percent')).toBeCloseTo(28.4, 10);
  });
  it('refuses to silently convert multiples to ratios', () => {
    expect(areUnitsCompatible('multiple', 'ratio')).toBe(false);
    expect(() => convert(2, 'multiple', 'percent')).toThrow();
  });
});

describe('session windows', () => {
  it('accepts an entry inside NY AM and rejects one outside', () => {
    const win = { start: '09:30', end: '11:00', timezone: 'America/New_York' };
    // 14:30 UTC = 10:30 EDT in March (DST active)
    expect(isWithinSession('2026-03-10T14:30:00.000Z', win)).toBe(true);
    // 16:30 UTC = 12:30 EDT
    expect(isWithinSession('2026-03-10T16:30:00.000Z', win)).toBe(false);
  });

  it('respects daylight saving transitions', () => {
    const win = { start: '09:30', end: '11:00', timezone: 'America/New_York' };
    // 14:30 UTC in January is 09:30 EST - inside the window
    expect(isWithinSession('2026-01-15T14:30:00.000Z', win)).toBe(true);
    // 14:30 UTC in July is 10:30 EDT - also inside
    expect(isWithinSession('2026-07-15T14:30:00.000Z', win)).toBe(true);
    // 13:30 UTC in January is 08:30 EST - outside
    expect(isWithinSession('2026-01-15T13:30:00.000Z', win)).toBe(false);
  });

  it('handles a window that crosses midnight', () => {
    const asia = { start: '22:00', end: '02:00', timezone: 'UTC' };
    expect(isWithinSession('2026-03-10T23:00:00.000Z', asia)).toBe(true);
    expect(isWithinSession('2026-03-10T01:00:00.000Z', asia)).toBe(true);
    expect(isWithinSession('2026-03-10T12:00:00.000Z', asia)).toBe(false);
  });

  it('treats start as inclusive and end as exclusive', () => {
    const win = { start: '09:30', end: '11:00', timezone: 'UTC' };
    expect(isWithinSession('2026-03-10T09:30:00.000Z', win)).toBe(true);
    expect(isWithinSession('2026-03-10T11:00:00.000Z', win)).toBe(false);
  });

  it('returns null for an unparseable timestamp or timezone', () => {
    expect(isWithinSession('not-a-date', { start: '09:30', end: '11:00', timezone: 'UTC' })).toBeNull();
    expect(isWithinSession('2026-03-10T10:00:00.000Z', { start: '09:30', end: '11:00', timezone: 'Mars/Olympus' })).toBeNull();
    expect(parseClock('25:00')).toBeNull();
    expect(minutesInTimezone('2026-03-10T00:00:00.000Z', 'UTC')).toBe(0);
  });
});

describe('display formatting', () => {
  it('strips binary float noise from derived values', async () => {
    const { formatFigure } = await import('@/lib/format');
    // 1.1642 - 1.1610 is 0.0031999999999999806 in binary floating point.
    expect(formatFigure(1.1642 - 1.161)).toBe('0.0032');
    expect(formatFigure(1.17 - 1.1642)).toBe('0.0058');
  });

  it('keeps precision where it matters and drops it where it does not', async () => {
    const { formatFigure, formatMultiple, formatPercent } = await import('@/lib/format');
    expect(formatFigure(1.16425)).toBe('1.1643');   // forex level
    expect(formatFigure(18234.567)).toBe('18234.57'); // index level
    expect(formatFigure(2)).toBe('2');
    expect(formatFigure(0)).toBe('0');
    expect(formatFigure(NaN)).toBe('—');
    expect(formatMultiple(1.8125)).toBe('1.81x');
    expect(formatPercent(46.15384)).toBe('46.2%');
  });
});

describe('ratio formatting', () => {
  it('holds two decimals regardless of magnitude', async () => {
    const { formatRatio } = await import('@/lib/format');
    // formatFigure would render these at four decimals, implying precision the
    // sample does not support.
    expect(formatRatio(2.8917)).toBe('2.89');
    expect(formatRatio(2.31333333)).toBe('2.31');
    expect(formatRatio(-0.0312)).toBe('-0.03');
    expect(formatRatio(2)).toBe('2.00');
    expect(formatRatio(NaN)).toBe('—');
  });
});
