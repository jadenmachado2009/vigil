import { NextResponse } from 'next/server';
import { currentUserId } from '@/auth';
import { DbAnalysisRepository } from '@/lib/repository/db-analyses';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  await new DbAnalysisRepository(userId).remove(id);
  return NextResponse.json({ ok: true });
}
