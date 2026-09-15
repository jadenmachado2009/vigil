import { describe, it, expect, afterEach } from 'vitest';
import { isDatabaseConfigured, authSecretRequired } from '@/db/availability';

/**
 * A deployment with no DATABASE_URL is a valid deployment: everything runs on
 * browser storage and only accounts are unavailable. These pin the gate that
 * decides that, because getting it wrong means either a 500 on every request or
 * a sign-up form that cannot work.
 */
const original = { ...process.env };

/** NODE_ENV is declared read-only in the Node types; assignment still works. */
function setEnv(key: string, value: string): void {
  (process.env as Record<string, string>)[key] = value;
}

afterEach(() => {
  process.env = { ...original };
});

describe('database availability gate', () => {
  it('is always available in development, with or without a URL', async () => {
    setEnv('NODE_ENV', 'development');
    delete process.env['DATABASE_URL'];
    expect(isDatabaseConfigured()).toBe(true);
  });

  it('is unavailable in production without a URL', async () => {
    setEnv('NODE_ENV', 'production');
    delete process.env['DATABASE_URL'];
    expect(isDatabaseConfigured()).toBe(false);
  });

  it('is available in production once a URL is supplied', async () => {
    setEnv('NODE_ENV', 'production');
    process.env['DATABASE_URL'] = 'postgres://user:pass@host/db';
    expect(isDatabaseConfigured()).toBe(true);
  });

  it('treats an empty URL as no URL', async () => {
    setEnv('NODE_ENV', 'production');
    process.env['DATABASE_URL'] = '';
    expect(isDatabaseConfigured()).toBe(false);
  });
});

describe('auth secret requirement', () => {
  it('is not required in development', () => {
    setEnv('NODE_ENV', 'development'); delete process.env['DATABASE_URL'];
    expect(authSecretRequired()).toBe(false);
  });

  it('is not required in production without a database — there is nothing to sign', () => {
    setEnv('NODE_ENV', 'production'); delete process.env['DATABASE_URL']; delete process.env['NEXT_PHASE'];
    expect(authSecretRequired()).toBe(false);
  });

  it('is required in production once a database is configured', () => {
    setEnv('NODE_ENV', 'production'); setEnv('DATABASE_URL', 'postgres://u:p@h/db'); delete process.env['NEXT_PHASE'];
    expect(authSecretRequired()).toBe(true);
  });

  it('is never required during the production build itself', () => {
    setEnv('NODE_ENV', 'production'); setEnv('DATABASE_URL', 'postgres://u:p@h/db'); setEnv('NEXT_PHASE', 'phase-production-build');
    expect(authSecretRequired()).toBe(false);
  });
});
