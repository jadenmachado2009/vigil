import { describe, it, expect } from 'vitest';
import type { AnalysisRecord } from '@/types/analysis';
import type { RuleResult } from '@/types/results';
import {
  computeTradeStatistics, computeInvestmentStatistics, maxDrawdown, byStrategy, MIN_SAMPLE,
} from '@/lib/analytics/statistics';
import { computeRuleAttribution, MIN_ARM } from '@/lib/analytics/attribution';

let seq = 0;
function result(metric: string, status: RuleResult['status']): RuleResult {
  return {
    ruleId: `r_${metric}`, metric, label: metric, status,
    mandatory: true, onFail: 'reject', expected: 'present', actual: null, reason: '',
  };
}

/** A closed trade with a settled R multiple and a given set of rule findings. */
function trade(r: number | null, results: RuleResult[] = [], overrides: Partial<AnalysisRecord> = {}): AnalysisRecord {
  seq += 1;
  return {
    id: `an_${seq}`,
    createdAt: `2026-03-${String((seq % 27) + 1).padStart(2, '0')}T10:00:00.000Z`,
    mode: 'trading',
    subject: 'EURUSD',
    strategyId: 's1', strategyName: 'NY AM FVG', strategyVersionId: 'v1', strategyVersion: 1,
    verdict: 'QUALIFIED', reason: '',
    summary: { mandatoryTotal: results.length, mandatoryPassed: 0, optionalTotal: 0, optionalPassed: 0 },
    results,
    computed: {}, observations: {}, provider: { name: 'mock', isMock: true },
    ...(r === null ? {} : {
      outcome: {
        kind: 'trade' as const, status: r > 0 ? 'WIN' as const : r < 0 ? 'LOSS' as const : 'BREAKEVEN' as const,
        exit: 0, rMultiple: r, updatedAt: '2026-04-01T00:00:00.000Z',
      },
    }),
    ...overrides,
  };
}

describe('trade statistics', () => {
  it('counts only closed positions', () => {
    const records = [
      trade(2), trade(-1),
      trade(null, [], { outcome: { kind: 'trade', status: 'OPEN', exit: null, rMultiple: null, updatedAt: 'x' } }),
      trade(null, [], { outcome: { kind: 'trade', status: 'NOT_TAKEN', exit: null, rMultiple: null, updatedAt: 'x' } }),
      trade(null),
    ];
    const s = computeTradeStatistics(records);
    expect(s.trades).toBe(2);
    expect(s.open).toBe(1);
    expect(s.notTaken).toBe(1);
  });

  it('computes the standard measures', () => {
    // +2, -1, +3, -1, 0
    const s = computeTradeStatistics([trade(2), trade(-1), trade(3), trade(-1), trade(0)]);
    expect(s.trades).toBe(5);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(2);
    expect(s.breakevens).toBe(1);
    expect(s.winRate).toBeCloseTo(40, 6);
    expect(s.totalR).toBeCloseTo(3, 6);
    expect(s.expectancy).toBeCloseTo(0.6, 6);
    expect(s.averageWinner).toBeCloseTo(2.5, 6);
    expect(s.averageLoser).toBeCloseTo(-1, 6);
    expect(s.profitFactor).toBeCloseTo(5 / 2, 6);
    expect(s.largestWinner).toBe(3);
    expect(s.largestLoser).toBe(-1);
  });

  it('refuses a profit factor when nothing has been lost', () => {
    // Dividing by zero here would render as Infinity and read as a perfect system.
    expect(computeTradeStatistics([trade(2), trade(1)]).profitFactor).toBeNull();
  });

  it('reports nulls rather than zeros with no data', () => {
    const s = computeTradeStatistics([]);
    expect(s.winRate).toBeNull();
    expect(s.expectancy).toBeNull();
    expect(s.averageWinner).toBeNull();
    expect(s.totalR).toBe(0);
  });

  it('marks a small sample as insufficient rather than dressing it up', () => {
    const s = computeTradeStatistics([trade(2), trade(3)]);
    expect(s.winRate).toBe(100);          // arithmetically true
    expect(s.sufficient).toBe(false);      // but not a win rate
    expect(s.sampleShortfall).toBe(MIN_SAMPLE - 2);
  });

  it('becomes sufficient at the threshold', () => {
    const s = computeTradeStatistics(Array.from({ length: MIN_SAMPLE }, () => trade(1)));
    expect(s.sufficient).toBe(true);
    expect(s.sampleShortfall).toBe(0);
  });
});

describe('drawdown', () => {
  it('measures the deepest peak-to-trough decline of cumulative R', () => {
    // cumulative: 2, 1, 4, 1, 2  -> peak 4, trough 1 -> 3
    expect(maxDrawdown([2, -1, 3, -3, 1])).toBeCloseTo(3, 6);
  });
  it('is zero for a curve that never gives anything back', () => {
    expect(maxDrawdown([1, 2, 3])).toBe(0);
  });
  it('counts an opening loss from the starting peak of zero', () => {
    expect(maxDrawdown([-2, 1])).toBeCloseTo(2, 6);
  });
  it('is zero with no trades', () => {
    expect(maxDrawdown([])).toBe(0);
  });
});

describe('rule attribution', () => {
  const withRule = (r: number) => trade(r, [result('inverse_fvg', 'PASS')]);
  const withoutRule = (r: number) => trade(r, [result('inverse_fvg', 'FAIL')]);
  const unverifiedRule = (r: number) => trade(r, [result('inverse_fvg', 'UNKNOWN')]);

  it('splits closed trades by whether the condition held', () => {
    const [attribution] = computeRuleAttribution([
      withRule(2), withRule(1), withoutRule(-1),
    ]);
    expect(attribution?.present.trades).toBe(2);
    expect(attribution?.absent.trades).toBe(1);
    expect(attribution?.present.expectancy).toBeCloseTo(1.5, 6);
    expect(attribution?.absent.expectancy).toBeCloseTo(-1, 6);
  });

  it('excludes unverified findings from BOTH arms', () => {
    // "We could not tell" is not "the condition was absent".
    const [attribution] = computeRuleAttribution([
      withRule(2), withoutRule(-1), unverifiedRule(5), unverifiedRule(-5),
    ]);
    expect(attribution?.present.trades).toBe(1);
    expect(attribution?.absent.trades).toBe(1);
    expect(attribution?.unverified).toBe(2);
    // The excluded trades must not move either arm's expectancy.
    expect(attribution?.present.expectancy).toBeCloseTo(2, 6);
    expect(attribution?.absent.expectancy).toBeCloseTo(-1, 6);
  });

  it('withholds a comparison until both arms have a usable sample', () => {
    const [attribution] = computeRuleAttribution([
      ...Array.from({ length: MIN_ARM }, () => withRule(1)),
      withoutRule(-1),
    ]);
    expect(attribution?.comparable).toBe(false);
    expect(attribution?.expectancyDelta).toBeNull();
  });

  it('reports a difference once both arms qualify', () => {
    const [attribution] = computeRuleAttribution([
      ...Array.from({ length: MIN_ARM }, () => withRule(2)),
      ...Array.from({ length: MIN_ARM }, () => withoutRule(0.5)),
    ]);
    expect(attribution?.comparable).toBe(true);
    expect(attribution?.expectancyDelta).toBeCloseTo(1.5, 6);
  });

  it('groups a condition by metric, so renaming a rule does not split its history', () => {
    const renamed = trade(1, [{ ...result('inverse_fvg', 'PASS'), label: 'Inverse FVG (v2)' }]);
    const original = trade(2, [result('inverse_fvg', 'PASS')]);
    const attribution = computeRuleAttribution([renamed, original]);
    expect(attribution).toHaveLength(1);
    expect(attribution[0]?.present.trades).toBe(2);
  });

  it('ignores open and unrecorded trades entirely', () => {
    const attribution = computeRuleAttribution([
      withRule(2),
      trade(null, [result('inverse_fvg', 'PASS')]),
    ]);
    expect(attribution[0]?.present.trades).toBe(1);
  });

  it('orders comparable rules ahead of unsupported ones', () => {
    const records = [
      ...Array.from({ length: MIN_ARM }, () => trade(1, [result('rr', 'PASS')])),
      ...Array.from({ length: MIN_ARM }, () => trade(-1, [result('rr', 'FAIL')])),
      trade(1, [result('bos', 'PASS')]),
    ];
    const attribution = computeRuleAttribution(records);
    expect(attribution[0]?.metric).toBe('rr');
    expect(attribution[0]?.comparable).toBe(true);
  });
});

describe('per-strategy and investment breakdowns', () => {
  it('separates strategies and ranks them by total R', () => {
    const rows = byStrategy([
      trade(2, [], { strategyName: 'A' }),
      trade(-1, [], { strategyName: 'B' }),
      trade(3, [], { strategyName: 'A' }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['A', 'B']);
    expect(rows[0]?.stats.totalR).toBeCloseTo(5, 6);
  });

  it('summarises investment outcomes', () => {
    const base = trade(null, [], { mode: 'investing' });
    const s = computeInvestmentStatistics([
      { ...base, id: 'i1', outcome: { kind: 'investment', status: 'SOLD', buyPrice: 100, sellPrice: 130, returnPercent: 30, updatedAt: 'x' } },
      { ...base, id: 'i2', outcome: { kind: 'investment', status: 'SOLD', buyPrice: 100, sellPrice: 90, returnPercent: -10, updatedAt: 'x' } },
      { ...base, id: 'i3', outcome: { kind: 'investment', status: 'HOLDING', buyPrice: 50, sellPrice: null, returnPercent: null, updatedAt: 'x' } },
    ]);
    expect(s.sold).toBe(2);
    expect(s.holding).toBe(1);
    expect(s.averageReturn).toBeCloseTo(10, 6);
    expect(s.bestReturn).toBe(30);
    expect(s.worstReturn).toBe(-10);
  });
});
