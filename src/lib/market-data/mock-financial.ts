import type { FinancialDataProvider, CompanySnapshot, CompanyRef } from './types';
import type { MetricDef } from '@/types/metrics';
import type { ObservationSet } from '@/types/observations';

const NAMES: Record<string, string> = {
  NVDA: 'NVIDIA Corporation', MSFT: 'Microsoft Corporation', AAPL: 'Apple Inc.',
  GOOGL: 'Alphabet Inc.', AMZN: 'Amazon.com, Inc.', META: 'Meta Platforms, Inc.',
  TSLA: 'Tesla, Inc.', KO: 'The Coca-Cola Company', JNJ: 'Johnson & Johnson',
  V: 'Visa Inc.', COST: 'Costco Wholesale Corporation', ASML: 'ASML Holding N.V.',
};

/**
 * A clearly-labelled demo source of fundamentals.
 *
 * These numbers are DERIVED FROM THE TICKER STRING, not from any filing or data
 * feed. They are internally consistent and stable per ticker so the product can
 * be demonstrated end to end without an API key, and every observation is
 * stamped `source: 'mock'` so the UI can say plainly that they are not real.
 */
export class MockFinancialProvider implements FinancialDataProvider {
  readonly name = 'Demo fundamentals (no live data)';
  readonly isMock = true;

  async search(query: string): Promise<CompanyRef[]> {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return Object.entries(NAMES)
      .filter(([ticker, name]) => ticker.includes(q) || name.toUpperCase().includes(q))
      .slice(0, 8)
      .map(([ticker, name]) => ({ ticker, name }));
  }

  async getSnapshot(ticker: string, requested: MetricDef[]): Promise<CompanySnapshot> {
    const symbol = ticker.trim().toUpperCase();
    const rand = mulberry32(hash(symbol));
    const asOf = quarterEnd();
    const observations: ObservationSet = {};

    // Draw a coherent company profile first, so the metrics agree with each other.
    const growth = 4 + rand() * 34;          // revenue growth, percent
    const quality = 6 + rand() * 40;         // ROIC, percent
    const leverage = Math.round(rand() * 380) / 100;
    const revenue = Math.round((5 + rand() * 250) * 1e9);
    const fcfMargin = -0.05 + rand() * 0.42;
    const forwardPe = 8 + rand() * 45;

    const values: Record<string, number | boolean | string> = {
      revenue_growth: round(growth),
      revenue_cagr: round(growth * (0.8 + rand() * 0.4)),
      eps_growth: round(growth * (0.6 + rand() * 0.9)),
      eps_cagr: round(growth * (0.7 + rand() * 0.6)),
      fcf_growth: round(growth * (0.5 + rand() * 1.1)),
      roic: round(quality),
      roe: round(quality * (1 + rand() * 0.6)),
      gross_margin: round(25 + rand() * 55),
      operating_margin: round(5 + rand() * 40),
      net_margin: round(2 + rand() * 32),
      debt_equity: round(leverage * (0.5 + rand())),
      debt_ebitda: leverage,
      current_ratio: round(0.7 + rand() * 3),
      interest_coverage: round(1 + rand() * 40),
      revenue,
      fcf: Math.round(revenue * fcfMargin),
      pe: round(forwardPe * (1 + rand() * 0.35)),
      forward_pe: round(forwardPe),
      ev_ebitda: round(5 + rand() * 30),
      ps: round(0.5 + rand() * 22),
      p_fcf: round(8 + rand() * 60),
      sector: ['Technology', 'Healthcare', 'Consumer Staples', 'Financials', 'Industrials'][
        Math.floor(rand() * 5)
      ] as string,
    };

    for (const metric of requested) {
      if (metric.origin === 'computed') continue; // code derives those
      const value = values[metric.id];
      if (value === undefined) {
        // Qualitative judgements are not something a data feed can supply.
        // Absent means INSUFFICIENT DATA until the user answers.
        continue;
      }
      observations[metric.id] = { value, source: 'mock', asOf, confidence: 1 };
    }

    return {
      ticker: symbol,
      name: NAMES[symbol] ?? `${symbol} (unlisted demo company)`,
      sector: values['sector'] as string,
      price: round(20 + rand() * 600),
      currency: 'USD',
      observations,
      providerName: this.name,
      isMock: true,
      warnings: [
        'Demo fundamentals: these figures were generated locally from the ticker, not taken from filings or a data feed. Configure a financial data provider for real numbers.',
      ],
    };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Most recent completed quarter, so freshness handling behaves realistically. */
function quarterEnd(): string {
  const now = new Date();
  const month = Math.floor(now.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(now.getUTCFullYear(), month, 0)).toISOString();
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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
