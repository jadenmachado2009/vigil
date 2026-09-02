import { NextResponse } from 'next/server';
import { currentUserId } from '@/auth';
import { DbAnalysisRepository } from '@/lib/repository/db-analyses';
import type { Outcome } from '@/types/analysis';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;

  let body: { outcome?: Outcome | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const outcome = body.outcome ?? null;
  if (outcome && outcome.kind !== 'trade' && outcome.kind !== 'investment') {
    return NextResponse.json({ error: 'Unknown outcome kind.' }, { status: 400 });
  }

  try {
    return NextResponse.json({ analysis: await new DbAnalysisRepository(userId).setOutcome(id, outcome) });
  } catch {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  await new DbAnalysisRepository(userId).remove(id);
  return NextResponse.json({ ok: true });
}
