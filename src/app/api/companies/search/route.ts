import { NextResponse } from 'next/server';
import { getFinancialProvider } from '@/lib/market-data';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? '';
  if (query.trim().length < 1) return NextResponse.json({ results: [] });
  const provider = getFinancialProvider();
  try {
    return NextResponse.json({ results: await provider.search(query), isMock: provider.isMock });
  } catch {
    // Search failing is not worth an error banner; the user can type a ticker.
    return NextResponse.json({ results: [], isMock: provider.isMock });
  }
}
