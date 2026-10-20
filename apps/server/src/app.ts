import { existsSync } from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import type { AppConfig } from './config.js';
import { openDatabase, type Db } from './db/index.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerPublicRoutes } from './routes/public.js';
import { GeminiWriter, type GeminiCopyWriter } from './services/gemini.js';
import { getCredentialHash, setCredentialHash } from './auth/sessions.js';
import { hashPassword } from './auth/password.js';

export type BuildOptions = {
  /** Inject a fake Gemini writer in tests / for forced fallback demos. */
  geminiWriter?: GeminiCopyWriter | null;
  /** Override the on-disk database (tests use ':memory:'). */
  databasePath?: string;
  /** Path to the built web client, when serving a single-port production build. */
  webDistPath?: string;
};

export async function buildApp(config: AppConfig, options: BuildOptions = {}): Promise<FastifyInstance> {
  const db: Db = openDatabase(options.databasePath ?? config.databasePath);

  const app = Fastify({
    logger:
      config.nodeEnv === 'test'
        ? false
        : {
            level: process.env.LOG_LEVEL ?? 'info',
            redact: {
              paths: [
                'req.headers.cookie',
                'req.headers["x-csrf-token"]',
                'req.headers.authorization',
                'res.headers["set-cookie"]',
                '*.phone',
                '*.password',
              ],
              censor: '[redacted]',
            },
            transport:
              config.nodeEnv === 'development' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
          },
    trustProxy: config.trustProxy,
    bodyLimit: 32 * 1024,
  });

  app.decorate('db', db);
  app.addHook('onClose', async () => {
    db.close();
  });

  await app.register(cookie, {});
  await app.register(rateLimit, {
    global: false,
    max: 60,
    timeWindow: '1 minute',
    // Behind the Vite dev proxy every request shares 127.0.0.1, so the
    // limiter is intentionally generous for local single-device use.
    keyGenerator: (request) => request.ip,
  });

  // Never leak stack traces or internal paths to the browser.
  app.setErrorHandler((error: unknown, request, reply) => {
    const status =
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? ((error as { statusCode: number }).statusCode)
        : 500;
    if (status >= 500) request.log.error({ err: error }, 'unhandled request error');
    if (status === 429) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many requests. Take a breath and retry.' });
    }
    return reply.code(status).send({
      error: status === 500 ? 'server_error' : 'request_failed',
      message: status === 500 ? 'Something went wrong on the host device.' : 'That request could not be completed.',
    });
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('x-frame-options', 'DENY');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('cross-origin-opener-policy', 'same-origin');
    const contentType = String(reply.getHeader('content-type') ?? '');
    if (contentType.includes('text/html')) {
      reply.header(
        'content-security-policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      );
    }
    return payload;
  });

  // Optional first-run password bootstrap from the environment.
  if (config.adminPassword && !getCredentialHash(db)) {
    setCredentialHash(db, await hashPassword(config.adminPassword));
  }

  const gemini =
    options.geminiWriter !== undefined
      ? options.geminiWriter
      : config.geminiEnabled
        ? new GeminiWriter({
            apiKey: config.geminiApiKey,
            model: config.geminiModel,
            timeoutMs: config.geminiTimeoutMs,
            logger: app.log,
          })
        : null;

  await registerPublicRoutes(app, { db, config, gemini: gemini ?? undefined });
  await registerAdminRoutes(app, { db, config });

  const webDist = options.webDistPath ?? path.resolve(process.cwd(), 'apps/web/dist');
  if (config.serveStatic && existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.type('text/html').sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found' });
      return reply
        .code(404)
        .type('text/plain')
        .send('BlaXaura API is running. Start the client with `npm run dev` (Vite serves the UI on :5173).');
    });
  }

  return app;
}
