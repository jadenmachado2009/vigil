import 'server-only';

/**
 * Company news, with sources.
 *
 * Headlines and links only — nothing is summarised, scored or read into an
 * observation. The spec asks for qualitative research with citations; a
 * headline you can click is a citation, a paragraph a model wrote about it is
 * not. Like the market strip, there is no demo fallback: an invented headline
 * about a real company is a false statement about the world.
 */

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
}

export interface NewsProvider {
  readonly name: string;
  getCompanyNews(symbol: string, days: number): Promise<NewsItem[]>;
}

class FinnhubNewsProvider implements NewsProvider {
  readonly name = 'Finnhub';
  constructor(private readonly apiKey: string) {}

  async getCompanyNews(symbol: string, days: number): Promise<NewsItem[]> {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${iso(from)}&to=${iso(to)}&token=${this.apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 900 } });
    if (!response.ok) return [];
    const rows = (await response.json()) as { headline?: string; source?: string; url?: string; datetime?: number }[];
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r) => r.headline && r.url && r.datetime)
      .slice(0, 8)
      .map((r) => ({
        headline: r.headline as string,
        source: r.source || 'Unknown source',
        url: r.url as string,
        publishedAt: new Date((r.datetime as number) * 1000).toISOString(),
      }));
  }
}

export function getNewsProvider(): NewsProvider | null {
  const key = process.env['FINNHUB_API_KEY'];
  return key ? new FinnhubNewsProvider(key) : null;
}
