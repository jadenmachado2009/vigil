import { NextResponse } from 'next/server';
import { getMarketProvider, DEFAULT_WATCHLIST } from '@/lib/market-data/market';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET() {
  const provider = getMarketProvider();
  if (!provider) {
    // No invented prices. The dashboard renders the absence instead.
    return NextResponse.json({ configured: false, quotes: [], source: null });
  }
  const quotes = await provider.getQuotes(DEFAULT_WATCHLIST);
  return NextResponse.json({ configured: true, quotes, source: provider.name });
}
