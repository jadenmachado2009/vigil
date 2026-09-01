import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { verifyPassword } from '@/lib/auth/passwords';

function resolveSecret(): string {
  const secret = process.env['AUTH_SECRET'];
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32');
  }
  // Development convenience only. Regenerated per process, so restarting the
  // dev server signs you out - which is preferable to shipping a known secret.
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
