import type { FinancialDataProvider, CompanySnapshot, CompanyRef } from './types';
import { FinancialDataUnavailableError } from './types';
import type { MetricDef } from '@/types/metrics';
import type { ObservationSet, Observation } from '@/types/observations';

const BASE = 'https://financialmodelingprep.com/api/v3';

/**
 * Fundamentals from Financial Modeling Prep. Server-side only.
 *
 * Field mapping is deliberately defensive: endpoint shapes and free-tier
 * coverage change, and a metric this provider cannot supply must simply be
 * ABSENT. Absent reads as INSUFFICIENT DATA downstream, which is correct - the
 * alternative, substituting a zero or a nearby field, would silently decide
 * rules with the wrong number.
 */
export class FmpFinancialProvider implements FinancialDataProvider {
  readonly name = 'Financial Modeling Prep';
  readonly isMock = false;

  constructor(private readonly apiKey: string) {}

  private async fetchJson<T>(path: string): Promise<T | null> {
    let response: Response;
    try {
      response = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}apikey=${this.apiKey}`, {
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new FinancialDataUnavailableError(
        `Could not reach the fundamentals provider: ${error instanceof Error ? error.message : 'network error'}`,
        true,
      );
    }
    if (response.status === 429) {
      throw new FinancialDataUnavailableError(
        'The fundamentals provider daily limit was reached. Free tiers are capped; try again later.',
        true,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new FinancialDataUnavailableError('The fundamentals API key was rejected.');
    }
    if (!response.ok) return null;
    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  async search(query: string): Promise<CompanyRef[]> {
    const rows = await this.fetchJson<{ symbol: string; name: string; exchangeShortName?: string }[]>(
      `/search?query=${encodeURIComponent(query)}&limit=8`,
    );
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      ticker: r.symbol,
      name: r.name,
      ...(r.exchangeShortName ? { exchange: r.exchangeShortName } : {}),
    }));
  }

  async getSnapshot(ticker: string, requested: MetricDef[]): Promise<CompanySnapshot> {
    const symbol = ticker.trim().toUpperCase();
    // Six calls per snapshot. Free tiers are capped per day, so callers should
    // expect this to be the expensive operation in the product.
    const [profile, metrics, ratios, growth, income, cashflow] = await Promise.all([
      this.fetchJson<Record<string, unknown>[]>(`/profile/${symbol}`),
      this.fetchJson<Record<string, unknown>[]>(`/key-metrics-ttm/${symbol}`),
      this.fetchJson<Record<string, unknown>[]>(`/ratios-ttm/${symbol}`),
      this.fetchJson<Record<string, unknown>[]>(`/income-statement-growth/${symbol}?limit=1`),
      this.fetchJson<Record<string, unknown>[]>(`/income-statement/${symbol}?limit=1`),
      this.fetchJson<Record<string, unknown>[]>(`/cash-flow-statement/${symbol}?limit=1`),
    ]);

    const p = profile?.[0] ?? {};
    const m = metrics?.[0] ?? {};
    const r = ratios?.[0] ?? {};
    const g = growth?.[0] ?? {};
    const inc = income?.[0] ?? {};
    const cf = cashflow?.[0] ?? {};

    if (!profile?.[0]) {
      throw new FinancialDataUnavailableError(`No company was found for "${symbol}".`);
    }

    const warnings: string[] = [];
    // TTM figures are as of now; growth comes from the last filed statement.
    const nowIso = new Date().toISOString();
    const statementDate = typeof g['date'] === 'string' ? new Date(g['date']).toISOString() : nowIso;

    // FMP returns margins and returns as ratios (0.42), our canonical unit is percent.
    const pct = (value: unknown): number | null => {
      const n = toNumber(value);
      return n === null ? null : n * 100;
    };

    const candidates: Record<string, { value: number | string | null; asOf: string }> = {
      revenue_growth: { value: pct(g['growthRevenue']), asOf: statementDate },
      eps_growth: { value: pct(g['growthEPS']), asOf: statementDate },
      fcf_growth: { value: pct(g['growthFreeCashFlow']), asOf: statementDate },
      roic: { value: pct(m['roic'] ?? m['returnOnInvestedCapitalTTM']), asOf: nowIso },
      roe: { value: pct(r['returnOnEquityTTM'] ?? m['roe']), asOf: nowIso },
      gross_margin: { value: pct(r['grossProfitMarginTTM']), asOf: nowIso },
      operating_margin: { value: pct(r['operatingProfitMarginTTM']), asOf: nowIso },
      net_margin: { value: pct(r['netProfitMarginTTM']), asOf: nowIso },
      debt_equity: { value: toNumber(r['debtEquityRatioTTM'] ?? m['debtToEquityTTM']), asOf: nowIso },
      debt_ebitda: { value: toNumber(m['netDebtToEBITDATTM'] ?? m['debtToEbitdaTTM']), asOf: nowIso },
      current_ratio: { value: toNumber(r['currentRatioTTM'] ?? m['currentRatioTTM']), asOf: nowIso },
      interest_coverage: { value: toNumber(r['interestCoverageTTM'] ?? m['interestCoverageTTM']), asOf: nowIso },
      // Absolute figures come from the statements, not the per-share TTM metrics:
      // FCF margin is meaningless if one side is per-share and the other is not.
      revenue: { value: toNumber(inc['revenue']), asOf: isoOr(inc['date'], nowIso) },
      fcf: { value: toNumber(cf['freeCashFlow']), asOf: isoOr(cf['date'], nowIso) },
      pe: { value: toNumber(r['priceEarningsRatioTTM'] ?? m['peRatioTTM']), asOf: nowIso },
      forward_pe: { value: toNumber(m['forwardPeTTM']), asOf: nowIso },
      ev_ebitda: { value: toNumber(m['enterpriseValueOverEBITDATTM']), asOf: nowIso },
      ps: { value: toNumber(r['priceToSalesRatioTTM'] ?? m['priceToSalesRatioTTM']), asOf: nowIso },
      p_fcf: { value: toNumber(r['priceToFreeCashFlowsRatioTTM'] ?? m['pfcfRatioTTM']), asOf: nowIso },
      sector: { value: typeof p['sector'] === 'string' ? p['sector'] : null, asOf: nowIso },
    };

    const observations: ObservationSet = {};
    const missing: string[] = [];
    for (const metric of requested) {
      if (metric.origin === 'computed') continue;
      const candidate = candidates[metric.id];
      if (!candidate || candidate.value === null) {
        if (metric.group !== 'qualitative') missing.push(metric.label);
        continue;
      }
      const observation: Observation = {
        value: candidate.value,
        source: 'financial-api',
        asOf: candidate.asOf,
      };
      observations[metric.id] = observation;
    }

    if (missing.length > 0) {
      warnings.push(
        `${missing.join(', ')} ${missing.length === 1 ? 'was' : 'were'} not available from this provider, so ${missing.length === 1 ? 'that rule' : 'those rules'} could not be verified.`,
      );
    }

    return {
      ticker: symbol,
      name: typeof p['companyName'] === 'string' ? p['companyName'] : symbol,
      ...(typeof p['sector'] === 'string' ? { sector: p['sector'] } : {}),
      ...(toNumber(p['price']) !== null ? { price: toNumber(p['price']) as number } : {}),
      ...(typeof p['currency'] === 'string' ? { currency: p['currency'] } : {}),
      observations,
      providerName: this.name,
      isMock: false,
      warnings,
    };
  }
}

function isoOr(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
