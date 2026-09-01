import 'server-only';
import * as schema from './schema';

/**
 * Database access.
 *
 * Local development uses PGlite - a real Postgres compiled to WASM that runs in
 * process against a file. No server to install, no account to create, and the
 * same SQL dialect as the hosted database, so nothing behaves differently when
 * DATABASE_URL is pointed at Neon, Supabase, or any other Postgres.
 */
export type Database = Awaited<ReturnType<typeof createDatabase>>;

const globalForDb = globalThis as unknown as {
  __strategyaiDb?: Promise<Database>;
};

async function createDatabase() {
  const url = process.env['DATABASE_URL'];

  if (url) {
    const [{ drizzle }, postgresModule] = await Promise.all([
      import('drizzle-orm/postgres-js'),
      import('postgres'),
    ]);
    const client = postgresModule.default(url, { max: 5 });
    return drizzle(client, { schema });
  }

  const [{ drizzle }, { PGlite }] = await Promise.all([
    import('drizzle-orm/pglite'),
    import('@electric-sql/pglite'),
  ]);
  const client = new PGlite(process.env['PGLITE_PATH'] ?? './pgdata');
  const db = drizzle(client, { schema });
  await applyMigrations(db);
  return db;
}

/**
 * PGlite starts empty, so the schema is applied on first use. A hosted database
 * is migrated with `npm run db:migrate` instead - applying DDL implicitly to a
 * shared database on request would be a bad idea.
 */
async function applyMigrations(db: unknown): Promise<void> {
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const { existsSync } = await import('node:fs');
  const folder = './drizzle';
  if (!existsSync(folder)) return;
  await migrate(db as never, { migrationsFolder: folder });
}

/** Cached across hot reloads so dev does not open a new database per request. */
export function getDb(): Promise<Database> {
  globalForDb.__strategyaiDb ??= createDatabase();
  return globalForDb.__strategyaiDb;
}

export { schema };
