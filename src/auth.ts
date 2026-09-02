import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { verifyPassword } from '@/lib/auth/passwords';

function resolveSecret(): string {
  const secret = process.env['AUTH_SECRET'];
  if (secret) return secret;

  // A production BUILD has no requests to sign, and env vars are commonly
  // injected only at runtime, so a missing secret must not fail compilation.
  // A production SERVER with no secret is a different matter and is refused.
  const building = process.env['NEXT_PHASE'] === 'phase-production-build';
  if (process.env.NODE_ENV === 'production' && !building) {
    throw new Error('AUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32');
  }

  // Last resort. `npm run dev` writes a stable secret to .env.local first, so
  // this is only reached during a build or if that step was skipped. A
  // per-process secret invalidates every session on restart, and because the
  // client falls back to browser storage when signed out, writes then stop
  // reaching the database silently.
  if (!building) {
    console.warn(
      'AUTH_SECRET is not set. Sessions will not survive a restart. Run: node scripts/ensure-dev-secret.mjs',
    );
  }
  globalThis.__strategyaiDevSecret ??= crypto.randomUUID();
  return globalThis.__strategyaiDevSecret;
}

declare global {
  // eslint-disable-next-line no-var
  var __strategyaiDevSecret: string | undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: resolveSecret(),
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = typeof credentials?.['email'] === 'string' ? credentials['email'].trim().toLowerCase() : '';
        const password = typeof credentials?.['password'] === 'string' ? credentials['password'] : '';
        if (!email || !password) return null;

        const db = await getDb();
        const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
        // Same failure for "no such user" and "wrong password", so the response
        // does not reveal which addresses have accounts.
        if (!user) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

/** Returns the signed-in user's id, or null. Use in route handlers. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
