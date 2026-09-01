import { NextResponse } from 'next/server';
import { currentUserId } from '@/auth';
import { DbAnalysisRepository } from '@/lib/repository/db-analyses';
import type { AnalysisRecord } from '@/types/analysis';

export const runtime = 'nodejs';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  return NextResponse.json({ analyses: await new DbAnalysisRepository(userId).list() });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  let record: AnalysisRecord;
  try {
    record = (await request.json()) as AnalysisRecord;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (!record?.verdict || !record.summary || !Array.isArray(record.results)) {
    return NextResponse.json({ error: 'An analysis record is required.' }, { status: 400 });
  }
  return NextResponse.json({ analysis: await new DbAnalysisRepository(userId).save(record) }, { status: 201 });
}
