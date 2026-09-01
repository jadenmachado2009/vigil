import { describe, it, expect } from 'vitest';
import { MockFinancialProvider } from '@/lib/market-data/mock-financial';
import { metricsForMode, getMetric } from '@/lib/metrics/catalog';
import { evaluateStrategy } from '@/lib/rules-engine';
import { qualityGrowth, obs, NOW } from './fixtures/strategies';

const provider = new MockFinancialProvider();
const investing = metricsForMode('investing').filter((m) => m.origin === 'observed');

describe('mock financial provider', () => {
  it('is labelled as demo data and warns that figures are generated', async () => {
    const snapshot = await provider.getSnapshot('NVDA', investing);
    expect(snapshot.isMock).toBe(true);
    expect(snapshot.warnings.join(' ')).toMatch(/generated locally from the ticker/);
  });

  it('stamps every observation as coming from the mock', async () => {
    const snapshot = await provider.getSnapshot('MSFT', investing);
    const sources = new Set(Object.values(snapshot.observations).map((o) => o.source));
    expect([...sources]).toEqual(['mock']);
  });

  it('is deterministic per ticker and differs between tickers', async () => {
    const a = await provider.getSnapshot('AAPL', investing);
    const b = await provider.getSnapshot('AAPL', investing);
    const c = await provider.getSnapshot('KO', investing);
    expect(a.observations).toEqual(b.observations);
    expect(a.observations).not.toEqual(c.observations);
  });

  it('never supplies a computed metric', async () => {
    const all = metricsForMode('investing');
    const snapshot = await provider.getSnapshot('COST', all);
    expect(snapshot.observations['fcf_positive']).toBeUndefined();
    expect(snapshot.observations['peg']).toBeUndefined();
    expect(snapshot.observations['fcf_margin']).toBeUndefined();
  });

  it('does not answer qualitative questions', async () => {
    const snapshot = await provider.getSnapshot('V', investing);
    expect(snapshot.observations['moat']).toBeUndefined();
  });

  it('supplies the raw inputs the engine needs to derive cash-flow metrics', async () => {
    const snapshot = await provider.getSnapshot('ASML', investing);
    expect(typeof snapshot.observations['fcf']?.value).toBe('number');
    expect(typeof snapshot.observations['revenue']?.value).toBe('number');
  });

  it('searches by ticker and by name', async () => {
    expect((await provider.search('NVD')).map((r) => r.ticker)).toContain('NVDA');
    expect((await provider.search('coca')).map((r) => r.ticker)).toContain('KO');
    expect(await provider.search('')).toEqual([]);
  });
});

describe('fundamentals through the engine', () => {
  it('derives fcf_positive from provider figures and reaches a verdict', async () => {
    const snapshot = await provider.getSnapshot('NVDA', investing);
    const analysis = evaluateStrategy({
      strategy: qualityGrowth,
      observations: snapshot.observations,
      options: { now: new Date().toISOString() },
    });
    // moat is optional in this strategy, so it cannot force INSUFFICIENT DATA.
    expect(['QUALIFIED', 'WATCH', 'REJECTED', 'INSUFFICIENT_DATA']).toContain(analysis.verdict);
    const fcfRule = analysis.results.find((r) => r.ruleId === 'i5');
    expect(fcfRule?.status === 'PASS' || fcfRule?.status === 'FAIL').toBe(true);
  });

  it('an unanswered mandatory qualitative rule yields INSUFFICIENT DATA, not a pass', async () => {
    const strategy = {
      ...qualityGrowth,
      rules: qualityGrowth.rules.map((r) => (r.id === 'i7' ? { ...r, mandatory: true } : r)),
    };
    const snapshot = await provider.getSnapshot('JNJ', investing);
    const analysis = evaluateStrategy({
      strategy,
      observations: snapshot.observations,
      options: { now: new Date().toISOString() },
    });
    const moat = analysis.results.find((r) => r.ruleId === 'i7');
    expect(moat?.status).toBe('UNKNOWN');
    expect(moat?.reason).toMatch(/not assumed to pass/);
  });

  it("the user's own judgement resolves a qualitative rule", async () => {
    const strategy = {
      ...qualityGrowth,
      rules: qualityGrowth.rules.map((r) => (r.id === 'i7' ? { ...r, mandatory: true } : r)),
    };
    const snapshot = await provider.getSnapshot('JNJ', investing);
    const analysis = evaluateStrategy({
      strategy,
      observations: {
        ...snapshot.observations,
        moat: { value: true, source: 'user', asOf: new Date().toISOString() },
      },
      options: { now: new Date().toISOString() },
    });
    expect(analysis.results.find((r) => r.ruleId === 'i7')?.status).toBe('PASS');
  });

  it('percent metrics keep their unit through the provider', () => {
    // A provider returning a ratio must be normalised, not compared raw.
    const analysis = evaluateStrategy({
      strategy: qualityGrowth,
      observations: {
        ...obs({ eps_growth: 31.2, debt_ebitda: 0.2, fcf: 10, revenue: 100, forward_pe: 30, moat: true }),
        revenue_growth: { value: 0.284, unit: 'ratio', source: 'financial-api', asOf: NOW },
        roic: { value: 0.421, unit: 'ratio', source: 'financial-api', asOf: NOW },
      },
      options: { now: NOW },
    });
    expect(analysis.results.find((r) => r.ruleId === 'i1')).toMatchObject({ status: 'PASS', actual: '28.4%' });
    expect(analysis.results.find((r) => r.ruleId === 'i3')).toMatchObject({ status: 'PASS', actual: '42.1%' });
  });

  it('requests only observed metrics that exist in the catalog', async () => {
    const snapshot = await provider.getSnapshot('TSLA', investing);
    for (const id of Object.keys(snapshot.observations)) {
      expect(getMetric(id)?.origin).toBe('observed');
    }
  });
});
