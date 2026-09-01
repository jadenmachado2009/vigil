import { NextResponse } from 'next/server';
import type { StrategyVersion } from '@/types/rules';
import type { ObservationSet } from '@/types/observations';
import { getMetric } from '@/lib/metrics/catalog';
import { getVisionProvider, ProviderUnavailableError } from '@/lib/ai';
import { evaluateStrategy } from '@/lib/rules-engine';
import { parseObservations } from '@/lib/ai/parse';

export const runtime = 'nodejs';

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface RequestBody {
  strategy?: StrategyVersion;
  images?: { mimeType?: string; base64?: string }[];
  /** Values the user typed in themselves. These outrank any model reading. */
  manual?: Record<string, unknown>;
  notes?: string;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Frontend → API → vision provider → observation layer → rules engine.
 *
 * The verdict is decided here, on the server, from validated observations. The
 * client never computes it.
 *
 * NOTE: until Phase 6 there is no database, so the strategy travels in the
 * request body. Once strategies are persisted, this handler must load the
 * StrategyVersion by id instead of trusting the client with its own rules.
 */
export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return bad('Request body was not valid JSON.');
  }

  const strategy = body.strategy;
  if (!strategy || !Array.isArray(strategy.rules) || strategy.rules.length === 0) {
    return bad('A strategy with at least one rule is required.');
  }
  if (strategy.mode !== 'trading') {
    return bad('This endpoint evaluates trading strategies. Use the investing checker for companies.');
  }

  const images = body.images ?? [];
  if (images.length > MAX_IMAGES) {
    return bad(`At most ${MAX_IMAGES} screenshots can be analysed at once.`);
  }
  for (const image of images) {
    if (!image.base64 || !image.mimeType) return bad('Each image needs a mimeType and base64 data.');
    if (!ALLOWED_TYPES.includes(image.mimeType)) {
      return bad(`Unsupported image type ${image.mimeType}. Use PNG, JPEG or WebP.`);
    }
    // base64 encodes 3 bytes per 4 characters.
    if ((image.base64.length * 3) / 4 > MAX_IMAGE_BYTES) return bad('Each screenshot must be under 5 MB.');
  }

  // Ask the reader only for what this strategy actually needs, plus the raw
  // price levels required to derive risk/reward in code.
  const needed = new Set<string>(['entry', 'stop', 'target', 'direction']);
  for (const rule of strategy.rules) if (rule.enabled) needed.add(rule.metric);
  const requestedMetrics = [...needed]
    .map((id) => getMetric(id))
    .filter((m): m is NonNullable<typeof m> => !!m && m.origin === 'observed');

  const warnings: string[] = [];
  let observations: ObservationSet = {};
  let providerName = 'none';
  let isMock = false;

  if (images.length > 0) {
    const provider = getVisionProvider();
    providerName = provider.name;
    isMock = provider.isMock;
    try {
      const result = await provider.readChart({
        images: images.map((i) => ({ mimeType: i.mimeType as string, base64: i.base64 as string })),
        requestedMetrics,
        ...(body.notes ? { notes: body.notes } : {}),
      });
      observations = result.observations;
      providerName = result.providerName;
      warnings.push(...result.warnings);
    } catch (error) {
      // A provider failure must never become a passing rule. Every unread metric
      // simply stays absent, which the engine reports as INSUFFICIENT DATA.
      const message = error instanceof ProviderUnavailableError
        ? error.message
        : 'The chart reader failed unexpectedly.';
      warnings.push(`${message} No chart observations were used.`);
    }
  } else {
    warnings.push('No screenshot was provided, so only the values you entered were used.');
  }

  // User-entered values outrank the reader: a human looking at their own chart
  // is a better source than a model guessing at it.
  const manual = parseObservations(body.manual ?? {}, requestedMetrics, {
    source: 'user',
    asOf: new Date().toISOString(),
  });
  warnings.push(...manual.warnings);
  for (const [key, value] of Object.entries(manual.observations)) {
    if (value.value !== null) observations[key] = value;
  }

  const minConfidence = Number(process.env['ENGINE_MIN_CONFIDENCE'] ?? '0.6');

  const analysis = evaluateStrategy({
    strategy,
    observations,
    options: { ...(Number.isFinite(minConfidence) ? { minConfidence } : {}) },
  });

  return NextResponse.json({
    analysis,
    observations,
    provider: { name: providerName, isMock },
    warnings,
  });
}
