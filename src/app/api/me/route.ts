import { NextResponse } from 'next/server';
import { auth, currentUserId } from '@/auth';

export const runtime = 'nodejs';

export async function GET() {
  const [session, userId] = await Promise.all([auth(), currentUserId()]);
  return NextResponse.json({
    signedIn: Boolean(userId),
    email: userId ? session?.user?.email ?? null : null,
    name: userId ? session?.user?.name ?? null : null,
  });
}
