import { NextResponse } from 'next/server';
import { currentUserId } from '@/auth';
import { DbStrategyRepository } from '@/lib/repository/db-strategies';
import type { CreateStrategyInput } from '@/lib/repository/types';

export const runtime = 'nodejs';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  return NextResponse.json({ strategies: await new DbStrategyRepository(userId).list() });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  let body: CreateStrategyInput;
  try {
    body = (await request.json()) as CreateStrategyInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (!body.name?.trim() || !Array.isArray(body.rules)) {
    return NextResponse.json({ error: 'A name and rules are required.' }, { status: 400 });
  }
  if (body.mode !== 'trading' && body.mode !== 'investing') {
    return NextResponse.json({ error: 'Mode must be trading or investing.' }, { status: 400 });
  }
  const created = await new DbStrategyRepository(userId).create(body);
  return NextResponse.json({ strategy: created }, { status: 201 });
}
