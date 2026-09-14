import { describe, it, expect } from 'vitest';
import { evaluateStrategy } from '@/lib/rules-engine';
import { parseObservations } from '@/lib/ai/parse';
import { getMetric } from '@/lib/metrics/catalog';
import { nyAmFvg, NOW } from './fixtures/strategies';

/**
 * Trading without any AI: the trader reports what they see, and the engine
 * decides. Before the "What you see" section existed, structural conditions
 * could only come from a chart reader, so without one a trading setup could
 * never qualify.
 */
const requested = ['htf_fvg', 'ltf_fvg', 'inverse_fvg', 'liquidity_target', 'entry', 'stop', 'target', 'entry_time']
  .map((id) => getMetric(id)!)
  .filter(Boolean);

/** The exact payload shape the checker sends, parsed the way the API parses it. */
function fromTrader(manual: Record<string, unknown>) {
  return parseObservations(manual, requested, { source: 'user', asOf: NOW }).observations;
}

const levels = {
  entry: 100, stop: 98, target: 105,          // RR 2.5
  entry_time: '2026-03-10T14:30:00.000Z',     // 10:30 New York, inside the AM window
};

describe('trading with no chart reader', () => {
  it('qualifies when the trader marks every condition present', () => {
    const analysis = evaluateStrategy({
      strategy: nyAmFvg,
      observations: fromTrader({ ...levels, htf_fvg: true, ltf_fvg: true, inverse_fvg: true }),
      options: { now: NOW },
    });
    expect(analysis.verdict).toBe('QUALIFIED');
    expect(analysis.results.filter((r) => r.mandatory).every((r) => r.status === 'PASS')).toBe(true);
    expect(analysis.results.find((r) => r.ruleId === 'r1')?.source).toBe('user');
  });

  it('rejects when the trader marks a required condition absent', () => {
    const analysis = evaluateStrategy({
      strategy: nyAmFvg,
      observations: fromTrader({ ...levels, htf_fvg: false, ltf_fvg: true, inverse_fvg: true }),
      options: { now: NOW },
    });
    expect(analysis.verdict).toBe('REJECTED');
  });

  it('watches when confirmation has not formed yet', () => {
    const observations = fromTrader({
      ...levels, htf_fvg: true, ltf_fvg: true,
      inverse_fvg: { value: false, pending: true },
    });
    expect(observations['inverse_fvg']).toMatchObject({ value: false, pending: true, source: 'user' });
    const analysis = evaluateStrategy({ strategy: nyAmFvg, observations, options: { now: NOW } });
    expect(analysis.verdict).toBe('WATCH');
  });

  it('treats "not sure" as no data, never as a pass', () => {
    // "Not sure" sends nothing for that condition.
    const analysis = evaluateStrategy({
      strategy: nyAmFvg,
      observations: fromTrader({ ...levels, htf_fvg: true, ltf_fvg: true }),
      options: { now: NOW },
    });
    expect(analysis.verdict).toBe('INSUFFICIENT_DATA');
    expect(analysis.results.find((r) => r.ruleId === 'r3')?.status).toBe('UNKNOWN');
  });

  it('still computes risk/reward from the levels rather than trusting a typed ratio', () => {
    const analysis = evaluateStrategy({
      strategy: nyAmFvg,
      observations: fromTrader({ ...levels, htf_fvg: true, ltf_fvg: true, inverse_fvg: true, rr: 9 }),
      options: { now: NOW },
    });
    expect(analysis.computed['rr']).toBeCloseTo(2.5, 10);
  });
});
