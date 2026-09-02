/**
 * Guarantees a stable AUTH_SECRET for local development.
 *
 * Auth.js encrypts the session cookie with this secret. Generating one per
 * process — as the app used to — means every dev-server restart invalidates
 * every session, and because the client falls back to browser storage when it
 * is signed out, writes silently stop reaching the database. That looked like a
 * persistence bug for several phases. It was a key-rotation bug.
 *
 * Writes to .env.local, which is gitignored. Never touches an existing value,
 * and never runs in production, where the secret must be supplied by the host.
 */
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const FILE = '.env.local';

if (process.env.NODE_ENV === 'production' || process.env.AUTH_SECRET) {
  process.exit(0);
}

const existing = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
if (/^AUTH_SECRET=.+$/m.test(existing)) {
  process.exit(0);
}

const secret = randomBytes(32).toString('base64');
const line = `\n# Generated for local development. Not a production secret.\nAUTH_SECRET=${secret}\n`;

if (existing) appendFileSync(FILE, line);
else writeFileSync(FILE, `# Local development environment. Gitignored.${line}`);

console.log(`Generated a development AUTH_SECRET in ${FILE} — sessions now survive restarts.`);
