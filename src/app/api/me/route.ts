import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  return NextResponse.json({
    signedIn: Boolean(session?.user?.id),
    email: session?.user?.email ?? null,
    name: session?.user?.name ?? null,
  });
}
