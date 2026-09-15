import type { ObservationSet, Observation, ObservationSource } from '@/types/observations';
import type { MetricDef } from '@/types/metrics';
import { isComputedMetric } from '@/lib/metrics/catalog';

/**
 * Converts an untrusted model response into observations.
 *
 * Everything here is defensive. A model may return extra keys, wrong types,
 * prose in a number field, or a confident-sounding value for a metric it was
 * never asked about. None of that is allowed to reach the rules engine:
 *
 *  - unknown metrics are dropped
 *  - computed metrics are dropped (code derives those, never a model)
 *  - values of the wrong type become null, which reads as INSUFFICIENT DATA
 *
 * The alternative - coercing a bad value into something usable - would let a
 * hallucination decide a verdict.
 */
export function parseObservations(
  raw: unknown,
  requestedMetrics: MetricDef[],
  meta: { source: ObservationSource; asOf: string },
): { observations: ObservationSet; warnings: string[] } {
  const warnings: string[] = [];
  const observations: ObservationSet = {};

  if (typeof raw !== 'object' || raw === null) {
    return { observations, warnings: ['The reading could not be parsed as structured data.'] };
  }

  const byId = new Map(requestedMetrics.map((m) => [m.id, m]));
  const record = raw as Record<string, unknown>;

  for (const [key, entry] of Object.entries(record)) {
    const metric = byId.get(key);
    if (!metric) continue; // silently ignore anything not asked for
    if (isComputedMetric(key)) {
      warnings.push(`Ignored a value for ${metric.label}: that figure is calculated, not observed.`);
      continue;
    }

    // Accept either a bare value or { value, confidence, pending, note }.
    const wrapped = typeof entry === 'object' && entry !== null && 'value' in entry
      ? (entry as Record<string, unknown>)
      : { value: entry };

    const value = normaliseValue(wrapped['value'], metric);
    const confidence = typeof wrapped['confidence'] === 'number'
      ? Math.min(1, Math.max(0, wrapped['confidence']))
      : undefined;

    const observation: Observation = {
      value,
      source: meta.source,
      asOf: meta.asOf,
      ...(confidence !== undefined ? { confidence } : {}),
      ...(wrapped['pending'] === true ? { pending: true } : {}),
      ...(typeof wrapped['note'] === 'string' && wrapped['note'] ? { note: wrapped['note'] } : {}),
    };

    if (value === null && wrapped['value'] !== null && wrapped['value'] !== undefined) {
      warnings.push(`${metric.label} was reported in a form that could not be used, so it was treated as unverified.`);
    }
    observations[key] = observation;
  }

  return { observations, warnings };
}

function normaliseValue(value: unknown, metric: MetricDef): number | boolean | string | null {
  if (value === null || value === undefined) return null;
  switch (metric.kind) {
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return null;
    case 'numeric': {
      const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
      return Number.isFinite(n) ? n : null;
    }
    case 'temporal':
      return typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? value : null;
    case 'categorical':
      return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}

export const UNREADABLE_CHART_WARNING =
  'The image could not be read as a price chart, so nothing was taken from it. Mark what you see instead.';

/**
 * True only when the reader explicitly said the image is not a readable price
 * chart. A missing answer changes nothing — a model that forgets the field must
 * not wipe out an otherwise good reading.
 *
 * This exists because on an image that is not really a chart, a model will
 * occasionally report a structure as absent rather than unknown, and absent on
 * a required rule means REJECTED. Asking the one question a picture can answer
 * reliably, and letting code act on it, keeps "could not tell" from becoming
 * "definitely not there".
 */
export function chartDeclaredUnreadable(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && (raw as Record<string, unknown>)['chart_readable'] === false;
}

/** Every observable metric recorded as unverified, with the reason attached. */
export function unreadableObservations(
  requestedMetrics: MetricDef[],
  asOf: string,
): ObservationSet {
  const observations: ObservationSet = {};
  for (const metric of requestedMetrics) {
    if (metric.origin !== 'observed') continue;
    observations[metric.id] = {
      value: null,
      source: 'vision',
      asOf,
      note: `${metric.label} could not be read: the image is not a readable price chart.`,
    };
  }
  return observations;
}
