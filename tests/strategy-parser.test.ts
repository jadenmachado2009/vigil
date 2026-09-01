import { describe, it, expect } from 'vitest';
import { PatternStrategyParser } from '@/lib/strategy-parser/pattern-parser';
import { evaluateStrategy } from '@/lib/rules-engine';

const parser = new PatternStrategyParser();
const investing = (description: string, answers?: Record<string, string>) =>
  parser.parse({ description, mode: 'investing', ...(answers ? { answers } : {}) });
const trading = (description: string, answers?: Record<string, string>) =>
  parser.parse({ description, mode: 'trading', ...(answers ? { answers } : {}) });

describe('parsing a described investment strategy', () => {
  it('extracts the example from the spec', async () => {
    const result = await investing(
      'I want companies growing revenue and EPS above 15%, ROIC above 15%, positive free cash flow, debt EBITDA below 2 and forward PE below 35.',
    );
    const byMetric = Object.fromEntries(result.rules.map((r) => [r.metric, r]));

    expect(byMetric['revenue_growth']).toMatchObject({ kind: 'numeric', operator: '>', value: 15, unit: 'percent' });
    expect(byMetric['eps_growth']).toMatchObject({ kind: 'numeric', operator: '>', value: 15 });
    expect(byMetric['roic']).toMatchObject({ kind: 'numeric', operator: '>', value: 15 });
    expect(byMetric['fcf_positive']).toMatchObject({ kind: 'boolean', expected: true });
    expect(byMetric['debt_ebitda']).toMatchObject({ kind: 'numeric', operator: '<', value: 2, unit: 'multiple' });
    expect(byMetric['forward_pe']).toMatchObject({ kind: 'numeric', operator: '<', value: 35 });
    expect(result.questions).toHaveLength(0);
  });

  it('produces rules the engine can actually run', async () => {
    const result = await investing('revenue growth at least 15%, roic at least 15%, debt to ebitda at most 2');
    const analysis = evaluateStrategy({
      strategy: {
        id: 'v', strategyId: 's', version: 1, mode: 'investing',
        createdAt: '2026-01-01T00:00:00.000Z', rules: result.rules,
      },
      observations: {
        revenue_growth: { value: 28, source: 'financial-api', asOf: '2026-03-01T00:00:00.000Z' },
        roic: { value: 42, source: 'financial-api', asOf: '2026-03-01T00:00:00.000Z' },
        debt_ebitda: { value: 0.2, source: 'financial-api', asOf: '2026-03-01T00:00:00.000Z' },
      },
      options: { now: '2026-03-10T00:00:00.000Z' },
    });
    expect(analysis.verdict).toBe('QUALIFIED');
  });

  it('asks instead of inventing a threshold', async () => {
    const result = await investing('I want a high ROIC and strong revenue growth');
    expect(result.rules.filter((r) => r.kind === 'numeric')).toHaveLength(0);
    const metrics = result.questions.map((q) => q.metric);
    expect(metrics).toContain('roic');
    expect(result.questions[0]?.question).toMatch(/threshold/i);
    expect(result.questions[0]?.suggestions?.length).toBeGreaterThan(0);
  });

  it('uses an answer to complete the rule it asked about', async () => {
    const first = await investing('I want a high ROIC');
    expect(first.rules).toHaveLength(0);
    const second = await investing('I want a high ROIC', { 'roic:threshold': '18' });
    expect(second.rules[0]).toMatchObject({ metric: 'roic', operator: '>=', value: 18 });
  });

  it('picks the sensible direction when none is stated', async () => {
    // ROIC is better higher, Debt/EBITDA better lower.
    const result = await investing('roic 15', { });
    expect(result.rules[0]).toMatchObject({ operator: '>=' });
    const debt = await investing('debt to ebitda 2');
    expect(debt.rules[0]).toMatchObject({ operator: '<=' });
  });

  it('marks hedged conditions optional', async () => {
    const result = await investing('roic above 15%, ideally a wide moat');
    const moat = result.rules.find((r) => r.metric === 'moat');
    expect(moat?.mandatory).toBe(false);
    expect(result.rules.find((r) => r.metric === 'roic')?.mandatory).toBe(true);
  });

  it('prefers the longer synonym', async () => {
    const forward = await investing('forward pe below 30');
    expect(forward.rules[0]?.metric).toBe('forward_pe');
    const revenue = await investing('revenue growth above 10');
    expect(revenue.rules[0]?.metric).toBe('revenue_growth');
  });

  it('reports phrases it did not understand instead of dropping them', async () => {
    const result = await investing('roic above 15% and vibes must be immaculate');
    expect(result.rules).toHaveLength(1);
    expect(result.unmatched.join(' ')).toMatch(/vibes/);
  });
});

describe('parsing a described trading strategy', () => {
  it('extracts structure, session and risk from prose', async () => {
    const result = await trading(
      'HTF fair value gap, then a 5m FVG with inverse FVG confirmation during the NY AM session, minimum RR 2',
    );
    const byMetric = Object.fromEntries(result.rules.map((r) => [r.metric, r]));
    expect(byMetric['htf_fvg']).toMatchObject({ kind: 'boolean', expected: true });
    expect(byMetric['ltf_fvg']).toMatchObject({ kind: 'boolean', expected: true });
    expect(byMetric['inverse_fvg']).toMatchObject({ kind: 'boolean', expected: true });
    expect(byMetric['entry_time']).toMatchObject({
      kind: 'temporal',
      window: { start: '09:30', end: '11:00', timezone: 'America/New_York' },
    });
    expect(byMetric['rr']).toMatchObject({ kind: 'numeric', operator: '>=', value: 2 });
  });

  it('reads an explicit time range and its timezone', async () => {
    const result = await trading('only trade 08:00 to 11:00 london session');
    expect(result.rules[0]).toMatchObject({
      kind: 'temporal',
      window: { start: '08:00', end: '11:00', timezone: 'Europe/London' },
    });
  });

  it('does not read a clock as a threshold', async () => {
    const result = await trading('session 09:30 to 11:00 new york');
    const rule = result.rules[0];
    expect(rule?.kind).toBe('temporal');
    expect(result.rules.some((r) => r.kind === 'numeric')).toBe(false);
  });

  it('handles negation', async () => {
    const result = await trading('no liquidity sweep before entry');
    expect(result.rules[0]).toMatchObject({ metric: 'liquidity_sweep', expected: false });
  });

  it('asks which session when none is named', async () => {
    const result = await trading('only during my session, minimum rr 2');
    const question = result.questions.find((q) => q.kind === 'session');
    expect(question).toBeDefined();
    expect(question?.suggestions?.length).toBeGreaterThan(0);
  });

  it('keeps investing metrics out of a trading strategy', async () => {
    const result = await trading('roic above 15% and htf fvg present');
    expect(result.rules.map((r) => r.metric)).toEqual(['htf_fvg']);
  });

  it('suggests a name', async () => {
    expect((await trading('htf fvg with inverse fvg')).suggestedName).toBe('FVG strategy');
    expect((await investing('roic above 15%')).suggestedName).toBe('Quality growth');
  });
});

describe('regressions', () => {
  it('does not read a comparator out of the middle of a word', async () => {
    // "compounders" contains "under", which a substring test reads as "<".
    const result = await investing('I like quality compounders with roic of 18');
    expect(result.rules.find((r) => r.metric === 'roic')).toMatchObject({ operator: '>=', value: 18 });
  });

  it('does not let a negation leak across a sentence', async () => {
    const result = await investing('roic above 15% and not much debt. Ideally a wide moat.');
    expect(result.rules.find((r) => r.metric === 'moat')).toMatchObject({ expected: true, mandatory: false });
  });

  it('does not let an optional marker leak backwards across a clause', async () => {
    const result = await investing('roic above 15%, ideally a wide moat');
    expect(result.rules.find((r) => r.metric === 'roic')?.mandatory).toBe(true);
    expect(result.rules.find((r) => r.metric === 'moat')?.mandatory).toBe(false);
  });

  it('asks about bare "debt" rather than dropping it', async () => {
    const result = await investing('roic above 15% and not much debt');
    expect(result.questions.map((q) => q.metric)).toContain('debt_ebitda');
  });

  it('still prefers the specific leverage phrase over bare debt', async () => {
    const result = await investing('debt to ebitda below 2');
    expect(result.rules[0]).toMatchObject({ metric: 'debt_ebitda', operator: '<', value: 2 });
  });

  it('keeps the answered threshold pointing the right way', async () => {
    const result = await investing(
      'I like quality compounders with a high ROIC and strong revenue growth',
      { 'roic:threshold': '18', 'revenue_growth:threshold': '12' },
    );
    expect(result.rules.find((r) => r.metric === 'roic')).toMatchObject({ operator: '>=', value: 18 });
    expect(result.rules.find((r) => r.metric === 'revenue_growth')).toMatchObject({ operator: '>=', value: 12 });
  });
});
