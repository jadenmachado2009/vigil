import { NextResponse } from 'next/server';
import { auth, currentUserId } from '@/auth';
import { isDatabaseConfigured } from '@/db/availability';

export const runtime = 'nodejs';

export async function GET() {
  // No database means no accounts. Say so, rather than offering a sign-up that
  // cannot work.
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ signedIn: false, email: null, name: null, accountsAvailable: false });
  }
  const [session, userId] = await Promise.all([auth(), currentUserId()]);
  return NextResponse.json({
    accountsAvailable: true,
    signedIn: Boolean(userId),
    email: userId ? session?.user?.email ?? null : null,
    name: userId ? session?.user?.name ?? null : null,
  });
}
