import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db } from '../db/index.js';

export const ADMIN_COOKIE = 'bx_admin';
export const CSRF_COOKIE = 'bx_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export type AdminSession = { expiresAt: Date };

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Server-side sessions: the cookie carries a random token, the database stores
 * only its SHA-256 hash. Deleting the row logs the host out immediately.
 */
export function createAdminSession(db: Db, hours: number, userAgent?: string): { token: string; csrfToken: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
  db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(now.toISOString());
  db.prepare('INSERT INTO admin_sessions (token_hash, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?)').run(
    sha256(token),
    now.toISOString(),
    expiresAt.toISOString(),
    userAgent?.slice(0, 200) ?? null,
  );
  return { token, csrfToken, expiresAt };
}

export function readAdminSession(db: Db, token: string | undefined): AdminSession | null {
  if (!token) return null;
  const row = db
    .prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ?')
    .get(sha256(token)) as { expires_at: string } | undefined;
  if (!row) return null;
  const expiresAt = new Date(row.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha256(token));
    return null;
  }
  return { expiresAt };
}

export function destroyAdminSession(db: Db, token: string | undefined): void {
  if (!token) return;
  db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha256(token));
}

export function purgeExpiredAdminSessions(db: Db): void {
  db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

/** Constant-time comparison for the double-submit CSRF token. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function getCredentialHash(db: Db): string | null {
  const row = db.prepare("SELECT value FROM admin_settings WHERE key = 'admin_password_hash'").get() as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setCredentialHash(db: Db, passwordHash: string): void {
  db.prepare(
    `INSERT INTO admin_settings (key, value, updated_at) VALUES ('admin_password_hash', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(passwordHash, new Date().toISOString());
}
