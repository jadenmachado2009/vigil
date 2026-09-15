import { NextResponse } from 'next/server';
import { getNewsProvider } from '@/lib/market-data/news';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get('symbol') ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: 'A valid ticker is required.' }, { status: 400 });
  }
  const provider = getNewsProvider();
  if (!provider) return NextResponse.json({ configured: false, items: [], source: null });
  try {
    const items = await provider.getCompanyNews(symbol, 14);
    return NextResponse.json({ configured: true, items, source: provider.name });
  } catch {
    return NextResponse.json({ configured: true, items: [], source: provider.name, error: 'News could not be fetched.' });
  }
}
