import 'server-only';

/**
 * Live quotes for the dashboard's watch strip.
 *
 * There is deliberately NO mock implementation here. Elsewhere a labelled demo
 * provider is fine — a simulated chart reading is obviously a demo, and the
 * verdict it feeds carries a banner saying so. A price is different: it is a
 * checkable fact about the world that someone might act on, and inventing one
 * would be indistinguishable from a real quote at a glance. With no provider
 * configured the strip says so and shows nothing.
 */

export interface Quote {
  symbol: string;
  label: string;
  /** Null when the provider returned nothing for this instrument. */
  price: number | null;
  changePercent: number | null;
  /**
   * False when the provider had no data. Kept in the list rather than dropped:
   * a watchlist that silently loses a row reads as if the instrument were
   * never there, when in fact it could not be priced.
   */
  available: boolean;
}

export interface MarketDataProvider {
  readonly name: string;
  getQuotes(symbols: { symbol: string; label: string }[]): Promise<Quote[]>;
}

const DEFAULT_WATCHLIST = [
  { symbol: 'BINANCE:BTCUSDT', label: 'BTC/USD' },
  { symbol: 'OANDA:EUR_USD', label: 'EUR/USD' },
  { symbol: 'SPY', label: 'S&P 500 (SPY)' },
  { symbol: 'NVDA', label: 'NVDA' },
];

class FinnhubMarketProvider implements MarketDataProvider {
  readonly name = 'Finnhub';
  constructor(private readonly apiKey: string) {}

  async getQuotes(symbols: { symbol: string; label: string }[]): Promise<Quote[]> {
    const results = await Promise.all(symbols.map(async ({ symbol, label }) => {
      try {
        const response = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`,
          { signal: AbortSignal.timeout(8000), next: { revalidate: 60 } },
        );
        if (!response.ok) return unavailable(symbol, label);
        const data = (await response.json()) as { c?: number; dp?: number };
        if (typeof data.c !== 'number' || data.c === 0) return unavailable(symbol, label);
        return {
          symbol, label, price: data.c,
          changePercent: typeof data.dp === 'number' ? data.dp : null,
          available: true,
        };
      } catch {
        // One unreachable symbol should not empty the whole strip.
        return unavailable(symbol, label);
      }
    }));
    return results;
  }
}

function unavailable(symbol: string, label: string): Quote {
  return { symbol, label, price: null, changePercent: null, available: false };
}

/** Null when no provider is configured — the caller must render an honest absence. */
export function getMarketProvider(): MarketDataProvider | null {
  const key = process.env['FINNHUB_API_KEY'];
  return key ? new FinnhubMarketProvider(key) : null;
}

export { DEFAULT_WATCHLIST };
