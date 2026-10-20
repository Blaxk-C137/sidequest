import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  CONSENT_TEXT_VERSION,
  contactRequestSchema,
  feedbackRequestSchema,
  FEEDBACK_TAGS,
  reportRequestSchema,
} from '@blaxaura/shared';
import type { AppConfig } from '../config.js';
import type { Db } from '../db/index.js';
import { nowIso } from '../db/index.js';
import { buildReport } from '../services/report.js';
import type { GeminiCopyWriter } from '../services/gemini.js';
import { normalizePhone } from '../services/phone.js';

export type PublicRouteDeps = {
  db: Db;
  config: AppConfig;
  gemini?: GeminiCopyWriter;
};

export async function registerPublicRoutes(app: FastifyInstance, deps: PublicRouteDeps): Promise<void> {
  const { db, config, gemini } = deps;

  app.get('/api/health', async () => ({
    ok: true,
    mode: gemini ? 'gemini' : 'fallback',
    model: gemini ? config.geminiModel : null,
  }));

  /** Optional: lets the host dashboard compute a completion rate. No PII. */
  app.post('/api/session/start', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    handler: async (_request, reply) => {
      const id = randomUUID();
      db.prepare('INSERT INTO sessions (id, created_at) VALUES (?, ?)').run(id, nowIso());
      return reply.send({ sessionId: id });
    },
  });

  app.post('/api/report', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      const parsed = reportRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_answers', message: 'Those answers could not be read.' });
      }
      const { answers, sessionId } = parsed.data;
      const report = await buildReport(answers, {
        gemini: gemini ? { write: (a, deterministic) => gemini.write(a, deterministic) } : undefined,
        logger: app.log,
      });

      // Store the session marker only — never the answers themselves.
      const id = sessionId ?? randomUUID();
      const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
      if (!existing) {
        db.prepare('INSERT INTO sessions (id, created_at, completed_at, report_mode) VALUES (?, ?, ?, ?)').run(
          id,
          nowIso(),
          nowIso(),
          report.mode,
        );
      } else {
        db.prepare('UPDATE sessions SET completed_at = ?, report_mode = ? WHERE id = ?').run(
          nowIso(),
          report.mode,
          id,
        );
      }
      return reply.send({ report, sessionId: id });
    },
  });

  app.post('/api/feedback', {
    config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      // A pasted essay should not fail the request: trim to the contract limit.
      const body = request.body as Record<string, unknown> | undefined;
      if (body && typeof body.comment === 'string' && body.comment.length > 500) {
        body.comment = body.comment.slice(0, 500);
      }
      const parsed = feedbackRequestSchema.safeParse(body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_feedback', message: 'That feedback could not be read.' });
      }
      const { sessionId, stars, comment, retryIntent } = parsed.data;
      const tags = parsed.data.tags.filter((tag) => (FEEDBACK_TAGS as readonly string[]).includes(tag));
      const knownSession =
        sessionId && db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId) ? sessionId : null;

      db.prepare(
        'INSERT INTO feedback (session_id, stars, tags, comment, retry_intent, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        knownSession,
        stars ?? null,
        JSON.stringify(tags),
        comment?.trim() ? comment.trim().slice(0, 500) : null,
        retryIntent ?? null,
        nowIso(),
      );
      return reply.send({ ok: true });
    },
  });

  /**
   * Voluntary contact exchange. The consent checkbox must be checked — the
   * schema requires `consent: true`, and the server writes its own timestamp
   * (never trusting a client-supplied one).
   */
  app.post('/api/contacts', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      const parsed = contactRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'consent_required',
          message: 'A name, a valid number and a checked consent box are needed to save a contact.',
        });
      }
      if (parsed.data.consent !== true) {
        return reply.code(400).send({ error: 'consent_required', message: 'Consent is required to save a number.' });
      }
      const phone = normalizePhone(parsed.data.phone);
      if (!phone.ok) {
        return reply.code(400).send({ error: 'invalid_phone', message: phone.message });
      }
      const existing = db
        .prepare('SELECT id FROM contacts WHERE normalized_phone = ?')
        .get(phone.e164) as { id: number } | undefined;
      if (existing) {
        return reply.code(409).send({
          error: 'already_saved',
          message: 'That number is already saved on this device.',
        });
      }
      db.prepare(
        `INSERT INTO contacts (display_name, normalized_phone, consent_text_version, consented_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        parsed.data.displayName.slice(0, 60),
        phone.e164,
        CONSENT_TEXT_VERSION,
        nowIso(),
        nowIso(),
      );
      return reply.code(201).send({ ok: true });
    },
  });
}
