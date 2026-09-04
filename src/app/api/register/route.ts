import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { isDatabaseConfigured } from '@/db/availability';
import { hashPassword, validateCredentials } from '@/lib/auth/passwords';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'This deployment has no database, so accounts are unavailable. Your work is held in this browser.' },
      { status: 503 },
    );
  }
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const problem = validateCredentials(body.email, body.password);
  if (problem) return NextResponse.json({ error: problem.message, field: problem.field }, { status: 400 });

  const email = (body.email as string).trim().toLowerCase();
  const db = await getDb();
  const [existing] = await db.select({ id: schema.users.id })
    .from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists.', field: 'email' }, { status: 409 });
  }

  await db.insert(schema.users).values({
    id: `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    email,
    name: body.name?.trim() || null,
    passwordHash: await hashPassword(body.password as string),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
