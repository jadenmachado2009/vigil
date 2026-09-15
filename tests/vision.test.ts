import { describe, it, expect } from 'vitest';
import { parseObservations, chartDeclaredUnreadable, unreadableObservations, UNREADABLE_CHART_WARNING } from '@/lib/ai/parse';
import { MockVisionProvider } from '@/lib/ai/mock-vision';
import { getMetric, metricsForMode } from '@/lib/metrics/catalog';
import { evaluateStrategy } from '@/lib/rules-engine';
import { nyAmFvg } from './fixtures/strategies';

const meta = { source: 'vision' as const, asOf: '2026-03-10T15:00:00.000Z' };
const requested = ['htf_fvg', 'inverse_fvg', 'entry', 'stop', 'target', 'rr', 'entry_time', 'direction']
  .map((id) => getMetric(id)!)
  .filter(Boolean);

describe('parsing an untrusted model response', () => {
  it('accepts bare values and wrapped values alike', () => {
    const { observations } = parseObservations(
      { htf_fvg: true, entry: { value: 1.1642, confidence: 0.9 } },
      requested, meta,
    );
    expect(observations['htf_fvg']?.value).toBe(true);
    expect(observations['entry']).toMatchObject({ value: 1.1642, confidence: 0.9, source: 'vision' });
  });

  it('drops metrics that were never requested', () => {
    const { observations } = parseObservations({ roic: 42, htf_fvg: true }, requested, meta);
    expect(observations['roic']).toBeUndefined();
  });

  it('refuses a computed metric supplied by the model', () => {
    const { observations, warnings } = parseObservations({ rr: 5, htf_fvg: true }, requested, meta);
    expect(observations['rr']).toBeUndefined();
    expect(warnings.join(' ')).toMatch(/calculated, not observed/);
  });

  it('turns an unusable value into null rather than coercing it', () => {
    const { observations, warnings } = parseObservations({ entry: 'about 1.16ish' }, requested, meta);
    expect(observations['entry']?.value).toBeNull();
    expect(warnings.join(' ')).toMatch(/could not be used/);
  });

  it('preserves an explicit null without warning', () => {
    const { observations, warnings } = parseObservations({ htf_fvg: null }, requested, meta);
    expect(observations['htf_fvg']?.value).toBeNull();
    expect(warnings).toHaveLength(0);
  });

  it('carries the pending flag through', () => {
    const { observations } = parseObservations(
      { inverse_fvg: { value: false, pending: true } }, requested, meta,
    );
    expect(observations['inverse_fvg']).toMatchObject({ value: false, pending: true });
  });

  it('clamps confidence into 0..1', () => {
    const { observations } = parseObservations({ htf_fvg: { value: true, confidence: 7 } }, requested, meta);
    expect(observations['htf_fvg']?.confidence).toBe(1);
  });

  it('survives a non-object response', () => {
    expect(parseObservations('sorry, I cannot help with that', requested, meta).observations).toEqual({});
    expect(parseObservations(null, requested, meta).warnings).toHaveLength(1);
  });

  it('rejects a timestamp that is not a date', () => {
    const { observations } = parseObservations({ entry_time: 'tuesday-ish' }, requested, meta);
    expect(observations['entry_time']?.value).toBeNull();
  });
});

describe('mock vision provider', () => {
  const provider = new MockVisionProvider();
  const metrics = metricsForMode('trading').filter((m) => m.origin === 'observed');
  const image = { mimeType: 'image/png', base64: 'aGVsbG8td29ybGQtY2hhcnQ=' };

  it('is labelled as a mock', () => {
    expect(provider.isMock).toBe(true);
  });

  it('warns that the reading is not real', async () => {
    const result = await provider.readChart({ images: [image], requestedMetrics: metrics });
    expect(result.warnings.join(' ')).toMatch(/not read from your chart/);
  });

  it('is deterministic for the same image', async () => {
    const a = await provider.readChart({ images: [image], requestedMetrics: metrics });
    const b = await provider.readChart({ images: [image], requestedMetrics: metrics });
    const values = (r: typeof a) => Object.fromEntries(Object.entries(r.observations).map(([k, v]) => [k, v.value]));
    expect(values(a)).toEqual(values(b));
  });

  it('differs for a different image', async () => {
    const a = await provider.readChart({ images: [image], requestedMetrics: metrics });
    const b = await provider.readChart({
      images: [{ mimeType: 'image/png', base64: 'YS1jb21wbGV0ZWx5LWRpZmZlcmVudC1jaGFydA==' }],
      requestedMetrics: metrics,
    });
    expect(JSON.stringify(a.observations)).not.toBe(JSON.stringify(b.observations));
  });

  it('never invents a computed metric', async () => {
    const withComputed = metricsForMode('trading');
    const result = await provider.readChart({ images: [image], requestedMetrics: withComputed });
    const { observations } = parseObservations(
      Object.fromEntries(Object.entries(result.observations).map(([k, v]) => [k, v.value])),
      withComputed, meta,
    );
    expect(observations['rr']).toBeUndefined();
  });

  it('produces a full range of verdicts across different charts', async () => {
    const verdicts = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const result = await provider.readChart({
        images: [{ mimeType: 'image/png', base64: `Y2hhcnQtc2FtcGxlLSR7${i}}` }],
        requestedMetrics: metrics,
      });
      verdicts.add(
        evaluateStrategy({
          strategy: nyAmFvg,
          observations: result.observations,
          options: { now: new Date().toISOString(), maxAgeDays: 5 },
        }).verdict,
      );
    }
    // A demo that always says QUALIFIED would be worse than useless.
    expect(verdicts.size).toBeGreaterThan(1);
    expect(verdicts.has('QUALIFIED')).toBe(true);
  });
});

describe('an image that is not a readable chart', () => {
  it('acts only on an explicit "not readable"', () => {
    expect(chartDeclaredUnreadable({ chart_readable: false })).toBe(true);
    expect(chartDeclaredUnreadable({ chart_readable: true })).toBe(false);
    // A model that forgets the field must not wipe out a good reading.
    expect(chartDeclaredUnreadable({ htf_fvg: true })).toBe(false);
    expect(chartDeclaredUnreadable({ chart_readable: 'no' })).toBe(false);
    expect(chartDeclaredUnreadable(null)).toBe(false);
    expect(chartDeclaredUnreadable('not json')).toBe(false);
  });

  it('records every observable condition as unverified, with the reason', () => {
    const metrics = ['htf_fvg', 'inverse_fvg', 'entry', 'rr'].map((id) => getMetric(id)!);
    const observations = unreadableObservations(metrics, '2026-03-10T15:00:00.000Z');
    expect(Object.keys(observations).sort()).toEqual(['entry', 'htf_fvg', 'inverse_fvg']); // rr is computed, never read
    for (const o of Object.values(observations)) {
      expect(o.value).toBeNull();
      expect(o.source).toBe('vision');
      expect(o.note).toMatch(/not a readable price chart/);
    }
    expect(UNREADABLE_CHART_WARNING).toMatch(/Mark what you see/);
  });

  it('turns an unreadable image into insufficient data, never a rejection', () => {
    const metrics = nyAmFvg.rules.map((r) => getMetric(r.metric)!).filter((m) => m.origin === 'observed');
    const analysis = evaluateStrategy({
      strategy: nyAmFvg,
      observations: unreadableObservations(metrics, '2026-03-10T15:00:00.000Z'),
      options: { now: '2026-03-10T15:00:00.000Z' },
    });
    expect(analysis.verdict).toBe('INSUFFICIENT_DATA');
    expect(analysis.results.some((r) => r.status === 'FAIL')).toBe(false);
  });

  it("still lets the trader's own marks decide on top of an unreadable image", () => {
    const now = '2026-03-10T15:00:00.000Z';
    const metrics = nyAmFvg.rules.map((r) => getMetric(r.metric)!).filter((m) => m.origin === 'observed');
    const observations = unreadableObservations(metrics, now);
    // The route merges the trader's values over the reader's, skipping nulls.
    const mine = {
      htf_fvg: true, ltf_fvg: true, inverse_fvg: true, liquidity_target: true,
      entry: 100, stop: 98, target: 105, entry_time: '2026-03-10T14:30:00.000Z',
    };
    for (const [key, value] of Object.entries(mine)) {
      observations[key] = { value, source: 'user', asOf: now };
    }
    const analysis = evaluateStrategy({ strategy: nyAmFvg, observations, options: { now } });
    expect(analysis.verdict).toBe('QUALIFIED');
  });
});
