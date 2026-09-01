import type { ObservationSet, Observation } from '@/types/observations.js';
import { COMPUTED_METRIC_IDS } from '@/lib/metrics/catalog.js';
import { computeTradeGeometry, type Direction } from '@/lib/calculations/trading.js';

/**
 * PRINCIPLE
 * Anything code can calculate, code calculates.
 *
 * Providers - including vision models - may only report raw observations.
 * Any computed metric arriving from a provider is discarded before evaluation,
 * so a model that hallucinates `rr: 5.0` cannot influence a verdict. The engine
 * recomputes it from entry / stop / target instead.
 */
export function stripComputedMetrics(observations: ObservationSet): {
  cleaned: ObservationSet;
  discarded: string[];
} {
  const cleaned: ObservationSet = {};
  const discarded: string[] = [];
  for (const [key, value] of Object.entries(observations)) {
    if (COMPUTED_METRIC_IDS.includes(key) && value.source !== 'computed') {
      discarded.push(key);
      continue;
    }
    cleaned[key] = value;
  }
  return { cleaned, discarded };
}

function num(set: ObservationSet, id: string): number | null {
  const value = set[id]?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function computed(
  value: number | boolean | null,
  asOf: string,
  note?: string,
): Observation {
  return { value, source: 'computed', asOf, ...(note ? { note } : {}) };
}

/**
 * Derives every computed metric the available observations support.
 * A derivation whose inputs are missing yields `null`, which the engine reads
 * as INSUFFICIENT DATA - never as a failing rule.
 */
export function deriveMetrics(
  observations: ObservationSet,
  now: string,
): { observations: ObservationSet; computed: Record<string, number | null>; notes: string[] } {
  const out: ObservationSet = { ...observations };
  const values: Record<string, number | null> = {};
  const notes: string[] = [];

  // --- trading geometry -----------------------------------------------
  const entry = num(observations, 'entry');
  const stop = num(observations, 'stop');
  const target = num(observations, 'target');
  const rawDirection = observations['direction']?.value;
  const direction =
    rawDirection === 'long' || rawDirection === 'short' ? (rawDirection as Direction) : null;

  if (entry !== null || stop !== null || target !== null) {
    const geometry = computeTradeGeometry({ entry, stop, target, direction });
    const asOf = observations['entry']?.asOf ?? now;
    if (geometry.invalidReason) notes.push(geometry.invalidReason);
    out['risk'] = computed(geometry.risk, asOf, geometry.invalidReason);
    out['reward'] = computed(geometry.reward, asOf, geometry.invalidReason);
    out['rr'] = computed(geometry.rr, asOf, geometry.invalidReason);
    values['risk'] = geometry.risk;
    values['reward'] = geometry.reward;
    values['rr'] = geometry.rr;
  }

  // --- fundamentals ----------------------------------------------------
  const fcf = num(observations, 'fcf');
  if (fcf !== null) {
    const asOf = observations['fcf']?.asOf ?? now;
    out['fcf_positive'] = computed(fcf > 0, asOf);
    const revenue = num(observations, 'revenue');
    const margin = revenue !== null && revenue !== 0 ? (fcf / revenue) * 100 : null;
    out['fcf_margin'] = computed(margin, asOf);
    values['fcf_margin'] = margin;
  }

  const pe = num(observations, 'pe');
  const epsGrowth = num(observations, 'eps_growth') ?? num(observations, 'eps_cagr');
  if (pe !== null && epsGrowth !== null) {
    const asOf = observations['pe']?.asOf ?? now;
    // A negative or zero growth rate makes PEG meaningless rather than large.
    const peg = epsGrowth > 0 ? pe / epsGrowth : null;
    out['peg'] = computed(peg, asOf, epsGrowth > 0 ? undefined : 'EPS growth is not positive, so PEG is undefined.');
    values['peg'] = peg;
  }

  return { observations: out, computed: values, notes };
}
