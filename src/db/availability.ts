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

/**
 * Whether a missing AUTH_SECRET is a fatal misconfiguration.
 *
 * Sessions only exist when accounts exist, and accounts only exist with a
 * database. A production deployment with no DATABASE_URL has nothing to sign,
 * so demanding a secret there would take down every route that imports the
 * auth module — including /api/me, which every page loads.
 */
export function authSecretRequired(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  if (process.env['NEXT_PHASE'] === 'phase-production-build') return false;
  return Boolean(process.env['DATABASE_URL']);
}
