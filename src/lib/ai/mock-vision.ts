import type { VisionProvider, VisionRequest, VisionResult } from './types';
import type { ObservationSet } from '@/types/observations';

/**
 * A clearly-labelled demo reader.
 *
 * It does NOT look at the chart. It derives a stable pseudo-random reading from
 * the bytes of the uploaded image, so the same screenshot always produces the
 * same observations and different screenshots produce different ones. That makes
 * the product demonstrable end to end without an API key, without pretending to
 * be a real analysis.
 *
 * It deliberately produces the full range of outcomes - including unreadable
 * metrics and unconfirmed conditions - so every verdict is reachable in demo mode.
 */
export class MockVisionProvider implements VisionProvider {
  readonly name = 'Demo reader (no AI)';
  readonly isMock = true;

  async readChart(request: VisionRequest): Promise<VisionResult> {
    const seed = hash(
      request.images.map((i) => i.base64.slice(0, 512)).join('|') + (request.notes ?? ''),
    );
    const rand = mulberry32(seed);
    const asOf = new Date().toISOString();
    const observations: ObservationSet = {};
    const warnings = [
      'Demo reading: these observations were generated locally, not read from your chart. Configure a vision provider for real analysis.',
    ];

    // Price geometry, drawn once so entry/stop/target stay internally consistent.
    const long = rand() > 0.4;
    const base = 100 + Math.round(rand() * 4000) / 100;
    const risk = Math.round((0.4 + rand() * 1.6) * 100) / 100;
    const rr = 0.8 + rand() * 2.6;
    const reward = Math.round(risk * rr * 100) / 100;
    const levels: Record<string, number | string> = {
      entry: base,
      stop: long ? round(base - risk) : round(base + risk),
      target: long ? round(base + reward) : round(base - reward),
      direction: long ? 'long' : 'short',
      entry_time: sessionTimestamp(rand()),
      instrument: 'DEMO',
      rsi: Math.round(30 + rand() * 40),
      risk_percent: Math.round(rand() * 200) / 100,
    };

    for (const metric of request.requestedMetrics) {
      const roll = rand();

      // ~8% of readings are genuinely unreadable, so INSUFFICIENT DATA is reachable.
      if (roll > 0.92) {
        observations[metric.id] = {
          value: null, source: 'mock', asOf,
          note: `${metric.label} could not be read from the image provided.`,
        };
        continue;
      }

      if (metric.kind === 'boolean') {
        const present = roll > 0.28;
        observations[metric.id] = {
          value: present, source: 'mock', asOf,
          confidence: round(0.6 + rand() * 0.39),
          // Confirmation conditions can legitimately be "not yet", which is WATCH.
          ...(!present && metric.group === 'confirmation' && rand() > 0.4 ? { pending: true } : {}),
        };
        continue;
      }

      const level = levels[metric.id];
      observations[metric.id] = level !== undefined
        ? { value: level, source: 'mock', asOf, confidence: round(0.7 + rand() * 0.29) }
        : { value: null, source: 'mock', asOf, note: `${metric.label} is not visible on a chart.` };
    }

    return { observations, providerName: this.name, warnings };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A timestamp inside or outside the New York morning, depending on the draw. */
function sessionTimestamp(roll: number): string {
  const date = new Date();
  // 14:00 UTC is ~09:00-10:00 New York depending on DST; spread across the day.
  date.setUTCHours(roll > 0.3 ? 14 + Math.floor(roll * 2) : 3 + Math.floor(roll * 10), 45, 0, 0);
  return date.toISOString();
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG - same seed, same reading, every time. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
