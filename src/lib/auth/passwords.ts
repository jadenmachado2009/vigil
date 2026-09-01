import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string, salt: Buffer, keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * scrypt from the Node standard library - memory-hard, no dependency, and the
 * parameters are visible in the stored hash so they can be raised later.
 * Format: scrypt$<salt hex>$<key hex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(keyHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  // Constant-time comparison: a fast reject leaks how much of the hash matched.
  return timingSafeEqual(actual, expected);
}

export interface CredentialProblem { field: 'email' | 'password'; message: string }

export function validateCredentials(email: unknown, password: unknown): CredentialProblem | null {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    return { field: 'email', message: 'Enter a valid email address.' };
  }
  if (typeof password !== 'string' || password.length < 10) {
    return { field: 'password', message: 'Use at least 10 characters.' };
  }
  if (password.length > 200) {
    return { field: 'password', message: 'That password is too long.' };
  }
  return null;
}
