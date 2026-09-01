import { NextResponse } from 'next/server';
import { currentUserId } from '@/auth';
import { DbStrategyRepository } from '@/lib/repository/db-strategies';
import type { UpdateStrategyInput } from '@/lib/repository/types';
import type { Strategy } from '@/types/rules';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const found = await new DbStrategyRepository(userId).get(id);
  if (!found) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ strategy: found });
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  let body: UpdateStrategyInput & { status?: Strategy['status'] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const repo = new DbStrategyRepository(userId);
  try {
    if (body.status) {
      if (!['active', 'inactive', 'archived'].includes(body.status)) {
        return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
      }
      return NextResponse.json({ strategy: await repo.setStatus(id, body.status) });
    }
    return NextResponse.json({ strategy: await repo.update(id, body) });
  } catch {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  await new DbStrategyRepository(userId).remove(id);
  return NextResponse.json({ ok: true });
}
