import { NextResponse } from 'next/server';
import { currentUserId } from '@/auth';
import { DbStrategyRepository } from '@/lib/repository/db-strategies';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json({ strategy: await new DbStrategyRepository(userId).duplicate(id) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
}
