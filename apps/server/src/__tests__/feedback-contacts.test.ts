import { afterEach, describe, expect, it } from 'vitest';
import { CONSENT_TEXT_VERSION } from '@blaxaura/shared';
import { makeApp } from './helpers.js';

type App = Awaited<ReturnType<typeof makeApp>>['app'];
const apps: App[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function app(options: Parameters<typeof makeApp>[0] = {}) {
  const built = await makeApp(options);
  apps.push(built.app);
  return built.app;
}

describe('POST /api/feedback', () => {
  it('saves a 5-star rating with tags and a comment', async () => {
    const server = await app();
    const response = await server.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: { stars: 5, tags: ['Fun', 'Loved my report'], comment: 'Genuinely fun two minutes.', retryIntent: 'yes' },
    });
    expect(response.statusCode).toBe(200);
    const row = server.db.prepare('SELECT * FROM feedback').get() as Record<string, unknown>;
    expect(row.stars).toBe(5);
    expect(JSON.parse(String(row.tags))).toEqual(['Fun', 'Loved my report']);
    expect(row.comment).toBe('Genuinely fun two minutes.');
    expect(row.retry_intent).toBe('yes');
    expect(row.session_id).toBeNull();
  });

  it('accepts an empty feedback submission (skip)', async () => {
    const server = await app();
    const response = await server.inject({ method: 'POST', url: '/api/feedback', payload: {} });
    expect(response.statusCode).toBe(200);
    expect((server.db.prepare('SELECT COUNT(*) AS c FROM feedback').get() as { c: number }).c).toBe(1);
  });

  it('drops unknown tags and clamps the comment', async () => {
    const server = await app();
    await server.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: { stars: 4, tags: ['Fun', 'Hacked tag'], comment: 'x'.repeat(900) },
    });
    const row = server.db.prepare('SELECT tags, comment FROM feedback').get() as { tags: string; comment: string };
    expect(JSON.parse(row.tags)).toEqual(['Fun']);
    expect(row.comment.length).toBeLessThanOrEqual(500);
  });

  it('rejects out-of-range stars and invalid retry intent', async () => {
    const server = await app();
    for (const payload of [{ stars: 6 }, { stars: 0 }, { retryIntent: 'absolutely' }]) {
      const response = await server.inject({ method: 'POST', url: '/api/feedback', payload });
      expect(response.statusCode).toBe(400);
    }
  });

  it('saves feedback with no contact and vice versa', async () => {
    const server = await app();
    await server.inject({ method: 'POST', url: '/api/feedback', payload: { stars: 5 } });
    expect((server.db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c).toBe(0);

    await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: 'Ada', phone: '+234 803 123 4567', consent: true },
    });
    expect((server.db.prepare('SELECT COUNT(*) AS c FROM feedback').get() as { c: number }).c).toBe(1);
  });
});

describe('POST /api/contacts (consented contact exchange)', () => {
  it('rejects a missing consent flag', async () => {
    const server = await app();
    const response = await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: 'Ada', phone: '+2348031234567' },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('consent_required');
    expect((server.db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c).toBe(0);
  });

  it('rejects consent: false', async () => {
    const server = await app();
    const response = await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: 'Ada', phone: '+2348031234567', consent: false },
    });
    expect(response.statusCode).toBe(400);
    expect((server.db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c).toBe(0);
  });

  it('normalises a Nigerian local number to E.164 and stores the server consent timestamp', async () => {
    const server = await app();
    const before = Date.now();
    const response = await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: '  Ada  ', phone: '0803 123 4567', consent: true, consentedAt: '1999-01-01T00:00:00Z' },
    });
    expect(response.statusCode).toBe(201);
    const row = server.db.prepare('SELECT * FROM contacts').get() as Record<string, string>;
    expect(row.normalized_phone).toBe('+2348031234567');
    expect(row.display_name).toBe('Ada');
    expect(row.consent_text_version).toBe(CONSENT_TEXT_VERSION);
    expect(new Date(row.consented_at).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('accepts an international number', async () => {
    const server = await app();
    const response = await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: 'Kwame', phone: '+233 20 123 4567', consent: true },
    });
    expect(response.statusCode).toBe(201);
    expect((server.db.prepare('SELECT normalized_phone AS p FROM contacts').get() as { p: string }).p).toBe('+233201234567');
  });

  it('rejects an invalid number', async () => {
    const server = await app();
    const response = await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: 'Ada', phone: '12', consent: true },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects a duplicate number without creating a second row', async () => {
    const server = await app();
    const payload = { displayName: 'Ada', phone: '+2348031234567', consent: true };
    expect((await server.inject({ method: 'POST', url: '/api/contacts', payload })).statusCode).toBe(201);
    const duplicate = await server.inject({ method: 'POST', url: '/api/contacts', payload });
    expect(duplicate.statusCode).toBe(409);
    expect((server.db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c).toBe(1);
  });

  it('never links a contact to quiz answers or a phone in the URL', async () => {
    const server = await app();
    await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: 'Ada', phone: '+2348031234567', consent: true },
    });
    const columns = (server.db.prepare('PRAGMA table_info(contacts)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).not.toContain('session_id');
    expect(columns).not.toContain('answers');
  });
});
