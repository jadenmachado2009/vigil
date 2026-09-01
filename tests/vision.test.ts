import { describe, it, expect } from 'vitest';
import { parseObservations } from '@/lib/ai/parse';
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
