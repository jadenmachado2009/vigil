import { NextResponse } from 'next/server';
import { currentUserId } from '@/auth';
import { DbPortfolioRepository } from '@/lib/repository/db-portfolios';
import type { Portfolio } from '@/lib/portfolio/types';

export const runtime = 'nodejs';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  return NextResponse.json({ portfolio: await new DbPortfolioRepository(userId).get() });
}

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  let body: Portfolio;
  try {
    body = (await request.json()) as Portfolio;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (!Array.isArray(body.positions) || typeof body.limits !== 'object') {
    return NextResponse.json({ error: 'Positions and limits are required.' }, { status: 400 });
  }
  for (const p of body.positions) {
    if (typeof p.ticker !== 'string' || !p.ticker.trim() || !Number.isFinite(p.weight) || p.weight < 0) {
      return NextResponse.json({ error: 'Each position needs a ticker and a non-negative weight.' }, { status: 400 });
    }
  }
  return NextResponse.json({ portfolio: await new DbPortfolioRepository(userId).save(body) });
}
