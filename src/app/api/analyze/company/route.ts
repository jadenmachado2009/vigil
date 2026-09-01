import { NextResponse } from 'next/server';
import type { StrategyVersion } from '@/types/rules';
import type { ObservationSet } from '@/types/observations';
import { getMetric } from '@/lib/metrics/catalog';
import { getFinancialProvider, FinancialDataUnavailableError } from '@/lib/market-data';
import { evaluateStrategy } from '@/lib/rules-engine';
import { parseObservations } from '@/lib/ai/parse';

export const runtime = 'nodejs';

interface RequestBody {
  strategy?: StrategyVersion;
  ticker?: string;
  /** Qualitative judgements only the user can make (moat, management quality). */
  manual?: Record<string, unknown>;
  notes?: string;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Frontend → API → fundamentals provider → observation layer → rules engine.
 *
 * Nothing here judges a company. It gathers figures, records where each came
 * from and how old it is, and hands them to the engine.
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
  if (strategy.mode !== 'investing') {
    return bad('This endpoint evaluates investment strategies. Use the chart checker for setups.');
  }

  const ticker = (body.ticker ?? '').trim();
  if (!ticker || !/^[A-Za-z0-9.\-]{1,12}$/.test(ticker)) {
    return bad('Enter a valid ticker, for example NVDA.');
  }

  const needed = new Set<string>();
  for (const rule of strategy.rules) if (rule.enabled) needed.add(rule.metric);
  // Raw inputs behind computed metrics must be fetched too.
  if (needed.has('fcf_positive') || needed.has('fcf_margin')) { needed.add('fcf'); needed.add('revenue'); }
  if (needed.has('peg')) { needed.add('pe'); needed.add('eps_growth'); }

  const requestedMetrics = [...needed]
    .map((id) => getMetric(id))
    .filter((m): m is NonNullable<typeof m> => !!m && m.origin === 'observed');

  const provider = getFinancialProvider();
  const warnings: string[] = [];
  let observations: ObservationSet = {};
  let company = { ticker: ticker.toUpperCase(), name: ticker.toUpperCase() } as {
    ticker: string; name: string; sector?: string; price?: number; currency?: string;
  };
  let providerName = provider.name;

  try {
    const snapshot = await provider.getSnapshot(ticker, requestedMetrics);
    observations = snapshot.observations;
    providerName = snapshot.providerName;
    warnings.push(...snapshot.warnings);
    company = {
      ticker: snapshot.ticker,
      name: snapshot.name,
      ...(snapshot.sector ? { sector: snapshot.sector } : {}),
      ...(snapshot.price !== undefined ? { price: snapshot.price } : {}),
      ...(snapshot.currency ? { currency: snapshot.currency } : {}),
    };
  } catch (error) {
    if (error instanceof FinancialDataUnavailableError) {
      // Data we could not fetch stays absent. Every affected rule becomes
      // INSUFFICIENT DATA rather than silently passing.
      warnings.push(`${error.message} No financial data was used.`);
    } else {
      return bad('The fundamentals provider failed unexpectedly.', 502);
    }
  }

  // The user's own qualitative answers. A data feed cannot assess a moat.
  const manual = parseObservations(body.manual ?? {}, requestedMetrics, {
    source: 'user',
    asOf: new Date().toISOString(),
  });
  warnings.push(...manual.warnings);
  for (const [key, value] of Object.entries(manual.observations)) {
    if (value.value !== null) observations[key] = value;
  }

  const analysis = evaluateStrategy({ strategy, observations });

  return NextResponse.json({
    analysis,
    observations,
    company,
    provider: { name: providerName, isMock: provider.isMock },
    warnings,
  });
}
