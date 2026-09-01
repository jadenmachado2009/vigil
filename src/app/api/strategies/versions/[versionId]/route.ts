import { NextResponse } from 'next/server';
import { currentUserId } from '@/auth';
import { DbStrategyRepository } from '@/lib/repository/db-strategies';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { versionId } = await params;
  const version = await new DbStrategyRepository(userId).getVersion(versionId);
  if (!version) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ version });
}
