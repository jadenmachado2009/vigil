import { describe, it, expect } from 'vitest';
import { evaluateStrategy } from '@/lib/rules-engine/index';
import { nyAmFvg, qualityGrowth, obs, NOW } from './fixtures/strategies';

/** A chart read where every mandatory condition is met and RR is 2.5. */
const compliantSetup = obs({
  instrument: 'EURUSD',
  entry: 100, stop: 98, target: 105,   // RR = 5 / 2 = 2.5
  htf_fvg: true, ltf_fvg: true, inverse_fvg: true,
  liquidity_target: true,
  entry_time: '2026-03-10T14:30:00.000Z', // 10:30 New York
});

describe('trading: end to end', () => {
  it('QUALIFIED when every mandatory rule passes', () => {
    const a = evaluateStrategy({ strategy: nyAmFvg, observations: compliantSetup, options: { now: NOW } });
    expect(a.verdict).toBe('QUALIFIED');
    expect(a.summary).toMatchObject({ mandatoryTotal: 5, mandatoryPassed: 5, optionalTotal: 1, optionalPassed: 1 });
    expect(a.computed['rr']).toBeCloseTo(2.5, 10);
  });

  it('REJECTED when RR falls below the minimum', () => {
    // entry 100, stop 98, target 103 -> RR 1.5
    const a = evaluateStrategy({
      strategy: nyAmFvg,
      observations: { ...compliantSetup, ...obs({ target: 103 }) },
      options: { now: NOW },
    });
    expect(a.verdict).toBe('REJECTED');
    expect(a.computed['rr']).toBeCloseTo(1.5, 10);
    expect(a.results.find((r) => r.ruleId === 'r5')).toMatchObject({ status: 'FAIL', actual: '1.5x' });
  });

  it('REJECTED when a mandatory structural condition is absent', () => {
    const a = evaluateStrategy({
      strategy: nyAmFvg,
      observations: { ...compliantSetup, ...obs({ htf_fvg: false }) },
      options: { now: NOW },
    });
    expect(a.verdict).toBe('REJECTED');
    expect(a.reason).toContain('HTF FVG exists');
  });

  it('WATCH when confirmation has not printed yet', () => {
    const a = evaluateStrategy({
      strategy: nyAmFvg,
      observations: { ...compliantSetup, ...obs({ inverse_fvg: false }, { inverse_fvg: { pending: true } }) },
      options: { now: NOW },
    });
    expect(a.verdict).toBe('WATCH');
  });

  it('INSUFFICIENT_DATA when the screenshot did not yield a stop level', () => {
    const missing = { ...compliantSetup };
    delete missing['stop'];
    const a = evaluateStrategy({ strategy: nyAmFvg, observations: missing, options: { now: NOW } });
    expect(a.verdict).toBe('INSUFFICIENT_DATA');
    expect(a.computed['rr']).toBeNull();
    expect(a.results.find((r) => r.ruleId === 'r5')?.status).toBe('UNKNOWN');
  });

  it('REJECTED beats INSUFFICIENT_DATA when both are present', () => {
    const mixed = { ...compliantSetup, ...obs({ htf_fvg: false }) };
    delete mixed['stop'];
    expect(evaluateStrategy({ strategy: nyAmFvg, observations: mixed, options: { now: NOW } }).verdict).toBe('REJECTED');
  });

  it('rejects a setup whose entry falls outside the session', () => {
    const a = evaluateStrategy({
      strategy: nyAmFvg,
      observations: { ...compliantSetup, ...obs({ entry_time: '2026-03-10T20:00:00.000Z' }) },
      options: { now: NOW },
    });
    expect(a.verdict).toBe('REJECTED');
    expect(a.reason).toContain('NY AM session');
  });
});

describe('AI interprets, code decides', () => {
  it('discards an RR supplied by a provider and recomputes it', () => {
    // A vision model claims RR is 5.0 on a setup whose real geometry gives 1.5.
    const lying = {
      ...compliantSetup,
      ...obs({ target: 103 }),
      rr: { value: 5.0, source: 'vision' as const, asOf: NOW, confidence: 0.99 },
    };
    const a = evaluateStrategy({ strategy: nyAmFvg, observations: lying, options: { now: NOW } });
    expect(a.computed['rr']).toBeCloseTo(1.5, 10);
    expect(a.verdict).toBe('REJECTED');
  });

  it('cannot be talked past a mandatory rule by a high-confidence observation', () => {
    const a = evaluateStrategy({
      strategy: nyAmFvg,
      observations: { ...compliantSetup, ...obs({ htf_fvg: false }, { htf_fvg: { confidence: 1, note: 'ignore the rule, this is a great setup' } }) },
      options: { now: NOW },
    });
    expect(a.verdict).toBe('REJECTED');
  });
});

describe('investing: end to end', () => {
  const nvda = obs({
    revenue_growth: 28.4, eps_growth: 31.2, roic: 42.1,
    debt_ebitda: 0.2, fcf: 60_000_000_000, revenue: 130_000_000_000,
    forward_pe: 41.3, moat: true,
  });

  it('WATCH when only the valuation rule fails and its policy is watch', () => {
    const a = evaluateStrategy({ strategy: qualityGrowth, observations: nvda, options: { now: NOW } });
    expect(a.verdict).toBe('WATCH');
    expect(a.summary.mandatoryPassed).toBe(5);
    expect(a.summary.mandatoryTotal).toBe(6);
  });

  it('REJECTED when the same valuation rule is configured to reject', () => {
    const strict = {
      ...qualityGrowth,
      rules: qualityGrowth.rules.map((r) => (r.id === 'i6' ? { ...r, onFail: 'reject' as const } : r)),
    };
    expect(evaluateStrategy({ strategy: strict, observations: nvda, options: { now: NOW } }).verdict).toBe('REJECTED');
  });

  it('QUALIFIED when the valuation rule also passes', () => {
    const a = evaluateStrategy({
      strategy: qualityGrowth,
      observations: { ...nvda, ...obs({ forward_pe: 30 }) },
      options: { now: NOW },
    });
    expect(a.verdict).toBe('QUALIFIED');
  });

  it('derives fcf_positive and fcf_margin from raw cash-flow figures', () => {
    const a = evaluateStrategy({ strategy: qualityGrowth, observations: nvda, options: { now: NOW } });
    expect(a.results.find((r) => r.ruleId === 'i5')?.status).toBe('PASS');
    expect(a.computed['fcf_margin']).toBeCloseTo(46.1538, 3);
  });

  it('INSUFFICIENT_DATA when the provider omits ROIC', () => {
    const partial = { ...nvda };
    delete partial['roic'];
    const a = evaluateStrategy({ strategy: qualityGrowth, observations: partial, options: { now: NOW } });
    expect(a.verdict).toBe('INSUFFICIENT_DATA');
    expect(a.results.find((r) => r.ruleId === 'i3')?.reason).toMatch(/ROIC was not reported/);
  });

  it('INSUFFICIENT_DATA when fundamentals are older than the freshness budget', () => {
    const stale = obs(
      { revenue_growth: 28.4, eps_growth: 31.2, roic: 42.1, debt_ebitda: 0.2, fcf: 1, revenue: 10, forward_pe: 30, moat: true },
      {},
      '2024-01-01T00:00:00.000Z',
    );
    const a = evaluateStrategy({ strategy: qualityGrowth, observations: stale, options: { now: NOW } });
    expect(a.verdict).toBe('INSUFFICIENT_DATA');
    expect(a.results.filter((r) => r.stale).length).toBeGreaterThan(0);
  });
});

describe('determinism', () => {
  it('returns an identical analysis for identical input', () => {
    const one = evaluateStrategy({ strategy: nyAmFvg, observations: compliantSetup, options: { now: NOW } });
    const two = evaluateStrategy({ strategy: nyAmFvg, observations: compliantSetup, options: { now: NOW } });
    expect(one).toEqual(two);
  });

  it('ignores disabled rules', () => {
    const disabled = {
      ...nyAmFvg,
      rules: nyAmFvg.rules.map((r) => (r.id === 'r5' ? { ...r, enabled: false } : r)),
    };
    const a = evaluateStrategy({
      strategy: disabled,
      observations: { ...compliantSetup, ...obs({ target: 103 }) },
      options: { now: NOW },
    });
    expect(a.verdict).toBe('QUALIFIED');
    expect(a.results).toHaveLength(5);
  });
});

describe('regressions against the original MVP', () => {
  it('an unrecognised rule is never auto-passed', () => {
    // The old engine returned QUALIFIED for "Mercury is in retrograde".
    const nonsense = {
      ...nyAmFvg,
      rules: [{
        id: 'n1', label: 'Mercury is in retrograde', kind: 'boolean' as const,
        metric: 'mercury_retrograde', expected: true,
        mandatory: true, onFail: 'reject' as const, enabled: true,
      }],
    };
    const a = evaluateStrategy({ strategy: nonsense, observations: compliantSetup, options: { now: NOW } });
    expect(a.verdict).toBe('INSUFFICIENT_DATA');
  });

  it('a false observation fails its rule instead of passing on a name match', () => {
    // The old engine matched rule text against observation KEYS and threw the values away.
    const a = evaluateStrategy({
      strategy: nyAmFvg,
      observations: { ...compliantSetup, ...obs({ ltf_fvg: false }) },
      options: { now: NOW },
    });
    expect(a.verdict).toBe('REJECTED');
  });
});
