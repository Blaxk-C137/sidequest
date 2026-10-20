import { Algorithm, hash, verify } from '@node-rs/argon2';

/**
 * Argon2id with OWASP-recommended baseline parameters (19 MiB, t=2, p=1).
 * Only the hash is ever stored; plaintext passwords never touch the database
 * or the logs.
 */
const HASH_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, { algorithm: Algorithm.Argon2id });
  } catch {
    return false;
  }
}

/** Minimums are enforced in the schema too; this is a second safety net. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return 'Use at least 10 characters.';
  if (/^(.)\1+$/.test(password)) return 'That password is too repetitive.';
  return null;
}

export const MIN_PASSWORD_LENGTH = 10;
