/**
 * Whether a durable database is available.
 *
 * Kept apart from the database client so anything can ask without pulling in
 * the client (and its server-only guard and WASM driver) to do it.
 *
 * Locally the embedded database always exists. In production it exists only if
 * DATABASE_URL was supplied — and a deployment without one is a perfectly good
 * deployment: everything runs on browser storage and only accounts are off.
 */
export function isDatabaseConfigured(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return Boolean(process.env['DATABASE_URL']);
}
