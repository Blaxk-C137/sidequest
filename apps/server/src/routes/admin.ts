import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { adminLoginSchema, adminQuerySchema, adminSetupSchema } from '@blaxaura/shared';
import type { AppConfig } from '../config.js';
import type { Db } from '../db/index.js';
import {
  ADMIN_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  createAdminSession,
  destroyAdminSession,
  getCredentialHash,
  readAdminSession,
  safeEqual,
  setCredentialHash,
} from '../auth/sessions.js';
import { MIN_PASSWORD_LENGTH, hashPassword, passwordProblem, verifyPassword } from '../auth/password.js';
import { formatPhoneForDisplay } from '../services/phone.js';

export type AdminRouteDeps = { db: Db; config: AppConfig };

type ContactRow = {
  id: number;
  display_name: string;
  normalized_phone: string;
  consent_text_version: string;
  consented_at: string;
  created_at: string;
};

type FeedbackRow = {
  id: number;
  session_id: string | null;
  stars: number | null;
  tags: string;
  comment: string | null;
  retry_intent: string | null;
  created_at: string;
};

const purgeSchema = z.object({ olderThanDays: z.number().int().min(1).max(3650) });

/** Escapes a CSV cell and defuses spreadsheet formula injection. */
function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function registerAdminRoutes(app: FastifyInstance, deps: AdminRouteDeps): Promise<void> {
  const { db, config } = deps;

  function setSessionCookies(reply: FastifyReply, token: string, csrfToken: string, expiresAt: Date): void {
    const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    const base = {
      path: '/',
      sameSite: 'strict' as const,
      secure: config.cookieSecure,
      maxAge,
    };
    reply.setCookie(ADMIN_COOKIE, token, { ...base, httpOnly: true });
    // Readable by the admin page so it can echo the value in a header.
    reply.setCookie(CSRF_COOKIE, csrfToken, { ...base, httpOnly: false });
  }

  function clearSessionCookies(reply: FastifyReply): void {
    reply.clearCookie(ADMIN_COOKIE, { path: '/' });
    reply.clearCookie(CSRF_COOKIE, { path: '/' });
  }

  function authenticated(request: FastifyRequest): { token: string; expiresAt: Date } | null {
    const token = request.cookies[ADMIN_COOKIE];
    const session = readAdminSession(db, token);
    if (!token || !session) return null;
    return { token, expiresAt: session.expiresAt };
  }

  /** Rejects unauthenticated requests and enforces double-submit CSRF. */
  async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const session = authenticated(request);
    if (!session) {
      await reply.code(401).send({ error: 'unauthorized', message: 'Sign in to the host dashboard.' });
      return;
    }
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (mutating) {
      const origin = request.headers.origin;
      if (origin) {
        const host = request.headers.host;
        let originHost: string | null = null;
        try {
          originHost = new URL(origin).host;
        } catch {
          originHost = null;
        }
        if (!originHost || originHost !== host) {
          await reply.code(403).send({ error: 'bad_origin', message: 'Request rejected.' });
          return;
        }
      }
      const header = request.headers[CSRF_HEADER];
      const cookie = request.cookies[CSRF_COOKIE];
      if (typeof header !== 'string' || !cookie || !safeEqual(header, cookie)) {
        await reply.code(403).send({ error: 'csrf_failed', message: 'Refresh the dashboard and try again.' });
      }
    }
  }

  /** Bootstrap: only possible while no credential exists, and never twice. */
  app.post('/api/admin/setup', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    handler: async (request, reply) => {
      if (getCredentialHash(db)) {
        return reply.code(409).send({ error: 'already_configured', message: 'A host password already exists.' });
      }
      const parsed = adminSetupSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'weak_password',
          message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
        });
      }
      const problem = passwordProblem(parsed.data.password);
      if (problem) return reply.code(400).send({ error: 'weak_password', message: problem });

      setCredentialHash(db, await hashPassword(parsed.data.password));
      const session = createAdminSession(db, config.adminSessionHours, request.headers['user-agent']);
      setSessionCookies(reply, session.token, session.csrfToken, session.expiresAt);
      return reply.code(201).send({ ok: true, csrfToken: session.csrfToken });
    },
  });

  app.post('/api/admin/login', {
    config: { rateLimit: { max: 6, timeWindow: '10 minutes' } },
    handler: async (request, reply) => {
      const parsed = adminLoginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid', message: 'Enter the host password.' });
      }
      const hash = getCredentialHash(db);
      if (!hash) {
        return reply.code(409).send({ error: 'not_configured', message: 'Set a host password first.' });
      }
      const ok = await verifyPassword(hash, parsed.data.password);
      if (!ok) {
        // Uniform message; the rate limiter handles brute force.
        return reply.code(401).send({ error: 'invalid_credentials', message: 'That password did not match.' });
      }
      const session = createAdminSession(db, config.adminSessionHours, request.headers['user-agent']);
      setSessionCookies(reply, session.token, session.csrfToken, session.expiresAt);
      return reply.send({ ok: true, csrfToken: session.csrfToken });
    },
  });

  app.post('/api/admin/logout', async (request, reply) => {
    const token = request.cookies[ADMIN_COOKIE];
    destroyAdminSession(db, token);
    clearSessionCookies(reply);
    return reply.send({ ok: true });
  });

  app.get('/api/admin/session', async (request) => {
    const session = authenticated(request);
    return {
      configured: Boolean(getCredentialHash(db)),
      authenticated: Boolean(session),
      expiresAt: session ? session.expiresAt.toISOString() : null,
    };
  });

  app.get('/api/admin/stats', { preHandler: requireAdmin }, async () => {
    const sessionRow = db
      .prepare('SELECT COUNT(*) AS started, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed FROM sessions')
      .get() as { started: number; completed: number | null };
    const feedback = db
      .prepare(
        `SELECT COUNT(*) AS total, AVG(stars) AS avg, SUM(CASE WHEN stars IS NULL THEN 1 ELSE 0 END) AS unrated FROM feedback`,
      )
      .get() as { total: number; avg: number | null; unrated: number | null };
    const distribution = db
      .prepare('SELECT stars, COUNT(*) AS count FROM feedback WHERE stars IS NOT NULL GROUP BY stars ORDER BY stars')
      .all() as { stars: number; count: number }[];
    const tagRows = db.prepare('SELECT tags FROM feedback').all() as { tags: string }[];
    const tagCounts = new Map<string, number>();
    for (const row of tagRows) {
      try {
        const tags = JSON.parse(row.tags) as unknown;
        if (Array.isArray(tags)) {
          for (const tag of tags) {
            if (typeof tag === 'string') tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
          }
        }
      } catch {
        /* ignore malformed rows */
      }
    }
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
    const recentComments = db
      .prepare(
        `SELECT id, comment, stars, created_at FROM feedback WHERE comment IS NOT NULL AND TRIM(comment) <> ''
         ORDER BY created_at DESC LIMIT 8`,
      )
      .all();
    const contacts = db.prepare('SELECT COUNT(*) AS total FROM contacts').get() as { total: number };
    const reportModes = db
      .prepare("SELECT report_mode, COUNT(*) AS count FROM sessions WHERE report_mode IS NOT NULL GROUP BY report_mode")
      .all() as { report_mode: string; count: number }[];

    const started = sessionRow.started ?? 0;
    const completed = sessionRow.completed ?? 0;
    return {
      sessions: {
        started,
        completed,
        completionRate: started === 0 ? null : Math.round((completed / started) * 100),
        modes: reportModes,
      },
      feedback: {
        total: feedback.total ?? 0,
        averageRating: feedback.avg === null ? null : Math.round((feedback.avg as number) * 10) / 10,
        unrated: feedback.unrated ?? 0,
        distribution: Array.from({ length: 5 }, (_, index) => ({
          stars: index + 1,
          count: distribution.find((row) => row.stars === index + 1)?.count ?? 0,
        })),
        topTags,
        recentComments,
      },
      contacts: { total: contacts.total ?? 0 },
    };
  });

  app.get('/api/admin/contacts', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = adminQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query', message: 'Invalid search.' });
    const { q, limit } = parsed.data;
    const rows = q
      ? (db
          .prepare(
            `SELECT * FROM contacts WHERE display_name LIKE ? OR normalized_phone LIKE ?
             ORDER BY created_at DESC LIMIT ?`,
          )
          .all(`%${q}%`, `%${q}%`, limit) as ContactRow[])
      : (db.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT ?').all(limit) as ContactRow[]);

    return {
      contacts: rows.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        phone: formatPhoneForDisplay(row.normalized_phone),
        consentedAt: row.consented_at,
        consentTextVersion: row.consent_text_version,
        createdAt: row.created_at,
      })),
    };
  });

  app.delete<{ Params: { id: string } }>('/api/admin/contacts/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const id = Number.parseInt(request.params.id, 10);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'invalid_id' });
    const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
    return reply.send({ ok: true, deleted: result.changes });
  });

  app.delete('/api/admin/contacts', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { confirm?: boolean } | undefined;
    if (body?.confirm !== true) {
      return reply.code(400).send({ error: 'confirmation_required', message: 'Confirm to delete all contacts.' });
    }
    const result = db.prepare('DELETE FROM contacts').run();
    return reply.send({ ok: true, deleted: result.changes });
  });

  app.get('/api/admin/feedback', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = adminQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    const rows = db
      .prepare('SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?')
      .all(parsed.data.limit) as FeedbackRow[];
    return {
      feedback: rows.map((row) => ({
        id: row.id,
        stars: row.stars,
        tags: safeJsonArray(row.tags),
        comment: row.comment,
        retryIntent: row.retry_intent,
        createdAt: row.created_at,
      })),
    };
  });

  app.delete<{ Params: { id: string } }>('/api/admin/feedback/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const id = Number.parseInt(request.params.id, 10);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'invalid_id' });
    const result = db.prepare('DELETE FROM feedback WHERE id = ?').run(id);
    return reply.send({ ok: true, deleted: result.changes });
  });

  app.delete('/api/admin/feedback', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { confirm?: boolean } | undefined;
    if (body?.confirm !== true) {
      return reply.code(400).send({ error: 'confirmation_required', message: 'Confirm to clear all feedback.' });
    }
    const result = db.prepare('DELETE FROM feedback').run();
    return reply.send({ ok: true, deleted: result.changes });
  });

  app.post('/api/admin/retention/purge', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = purgeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_window' });
    const cutoff = new Date(Date.now() - parsed.data.olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const contacts = db.prepare('DELETE FROM contacts WHERE created_at < ?').run(cutoff).changes;
    const feedback = db.prepare('DELETE FROM feedback WHERE created_at < ?').run(cutoff).changes;
    db.prepare('DELETE FROM sessions WHERE created_at < ?').run(cutoff);
    return reply.send({ ok: true, contacts, feedback, cutoff });
  });

  app.get('/api/admin/export/contacts', { preHandler: requireAdmin }, async (_request, reply) => {
    const rows = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all() as ContactRow[];
    const header = ['name', 'phone_e164', 'consented_at', 'consent_text_version', 'saved_at'];
    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push(
        [row.display_name, row.normalized_phone, row.consented_at, row.consent_text_version, row.created_at]
          .map(csvCell)
          .join(','),
      );
    }
    const stamp = new Date().toISOString().slice(0, 10);
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="blaxaura-contacts-${stamp}.csv"`)
      .header('cache-control', 'no-store');
    return reply.send(`\uFEFF${lines.join('\r\n')}`);
  });
}

function safeJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
