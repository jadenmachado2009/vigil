import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Only needed for `drizzle-kit push`/`studio` against a hosted database.
  // Migration files are generated from the schema alone.
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/strategyai' },
} satisfies Config;
