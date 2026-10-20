import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { adminLogin, makeApp } from './helpers.js';

type App = Awaited<ReturnType<typeof makeApp>>['app'];
const apps: App[] = [];
const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(dirs.splice(0).map((dir) => rmSync(dir, { recursive: true, force: true })));
});

async function app(options: Parameters<typeof makeApp>[0] = {}) {
  const built = await makeApp(options);
  apps.push(built.app);
  return built.app;
}

const PASSWORD = 'a-strong-host-passphrase';

describe('admin authentication', () => {
  it('rejects every protected endpoint when unauthenticated', async () => {
    const server = await app();
    const routes: [string, string][] = [
      ['GET', '/api/admin/stats'],
      ['GET', '/api/admin/contacts'],
      ['GET', '/api/admin/feedback'],
      ['GET', '/api/admin/export/contacts'],
      ['DELETE', '/api/admin/contacts/1'],
      ['DELETE', '/api/admin/feedback/1'],
      ['POST', '/api/admin/retention/purge'],
    ];
    for (const [method, url] of routes) {
      const response = await server.inject({ method: method as 'GET', url });
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('reports setup state without leaking the hash', async () => {
    const server = await app();
    const fresh = await server.inject({ method: 'GET', url: '/api/admin/session' });
    expect(JSON.parse(fresh.body)).toEqual({ configured: false, authenticated: false, expiresAt: null });

    await adminLogin(server);
    const configured = await server.inject({ method: 'GET', url: '/api/admin/session' });
    const body = JSON.parse(configured.body);
    expect(body.configured).toBe(true);
    expect(configured.body).not.toMatch(/argon2|\$argon/i);
  });

  it('refuses weak passwords and never stores plaintext', async () => {
    const server = await app();
    const weak = await server.inject({ method: 'POST', url: '/api/admin/setup', payload: { password: 'short' } });
    expect(weak.statusCode).toBe(400);
    const ok = await server.inject({ method: 'POST', url: '/api/admin/setup', payload: { password: PASSWORD } });
    expect(ok.statusCode).toBe(201);

    const row = server.db.prepare("SELECT value FROM admin_settings WHERE key = 'admin_password_hash'").get() as { value: string };
    expect(row.value).not.toBe(PASSWORD);
    expect(row.value.startsWith('$argon2id$')).toBe(true);

    const second = await server.inject({ method: 'POST', url: '/api/admin/setup', payload: { password: 'another-long-pass' } });
    expect(second.statusCode).toBe(409);
  });

  it('rejects a wrong password and accepts the right one', async () => {
    const server = await app();
    // adminLogin() performs first-run setup and returns a valid session.
    await adminLogin(server, PASSWORD);
    const wrong = await server.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'not-the-password' } });
    expect(wrong.statusCode).toBe(401);
    const right = await server.inject({ method: 'POST', url: '/api/admin/login', payload: { password: PASSWORD } });
    expect(right.statusCode).toBe(200);
  });

  it('throttles repeated login attempts', async () => {
    const server = await app({ config: { adminPassword: PASSWORD } });
    const statuses: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      const response = await server.inject({
        method: 'POST',
        url: '/api/admin/login',
        payload: { password: `wrong-${i}` },
        remoteAddress: '10.0.0.9',
      });
      statuses.push(response.statusCode);
    }
    expect(statuses).toContain(429);
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThanOrEqual(2);
  });

  it('logs out and invalidates the session server-side', async () => {
    const server = await app();
    const { cookie, csrf } = await adminLogin(server);
    const before = await server.inject({ method: 'GET', url: '/api/admin/stats', headers: { cookie } });
    expect(before.statusCode).toBe(200);
    await server.inject({ method: 'POST', url: '/api/admin/logout', headers: { cookie, 'x-csrf-token': csrf } });
    const after = await server.inject({ method: 'GET', url: '/api/admin/stats', headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });

  it('requires a matching CSRF token for mutations', async () => {
    const server = await app();
    const { cookie, csrf } = await adminLogin(server);

    const noToken = await server.inject({
      method: 'DELETE',
      url: '/api/admin/contacts/1',
      headers: { cookie },
    });
    expect(noToken.statusCode).toBe(403);

    const wrongToken = await server.inject({
      method: 'DELETE',
      url: '/api/admin/contacts/1',
      headers: { cookie, 'x-csrf-token': 'nope' },
    });
    expect(wrongToken.statusCode).toBe(403);

    const crossOrigin = await server.inject({
      method: 'DELETE',
      url: '/api/admin/contacts/1',
      headers: { cookie, 'x-csrf-token': csrf, origin: 'https://evil.example' },
    });
    expect(crossOrigin.statusCode).toBe(403);
  });
});

describe('admin data management', () => {
  it('aggregates stats without exposing phone numbers', async () => {
    const server = await app();
    const { cookie } = await adminLogin(server);
    for (const stars of [5, 5, 3]) {
      await server.inject({ method: 'POST', url: '/api/feedback', payload: { stars, tags: ['Fun'], comment: 'lovely' } });
    }
    await server.inject({ method: 'POST', url: '/api/feedback', payload: { tags: ['Too long'] } });
    await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: 'Ada', phone: '+2348031234567', consent: true },
    });
    await server.inject({ method: 'POST', url: '/api/report', payload: { answers: { energy: 'chic' } } });

    const response = await server.inject({ method: 'GET', url: '/api/admin/stats', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    const stats = JSON.parse(response.body);
    expect(stats.feedback.total).toBe(4);
    expect(stats.feedback.averageRating).toBe(4.3);
    expect(stats.feedback.unrated).toBe(1);
    expect(stats.feedback.distribution.find((d: { stars: number }) => d.stars === 5).count).toBe(2);
    expect(stats.feedback.topTags[0]).toEqual({ tag: 'Fun', count: 3 });
    expect(stats.contacts.total).toBe(1);
    expect(stats.sessions.completed).toBe(1);
    expect(response.body).not.toContain('+2348031234567');
  });

  it('lists, searches and deletes contacts and clears them all', async () => {
    const server = await app();
    const { cookie, csrf } = await adminLogin(server);
    const headers = { cookie, 'x-csrf-token': csrf };
    for (const [displayName, phone] of [
      ['Ada', '+2348031234567'],
      ['Bola', '+2348098765432'],
    ]) {
      await server.inject({ method: 'POST', url: '/api/contacts', payload: { displayName, phone, consent: true } });
    }

    const all = await server.inject({ method: 'GET', url: '/api/admin/contacts', headers });
    const contacts = JSON.parse(all.body).contacts as { id: number; displayName: string; phone: string }[];
    expect(contacts).toHaveLength(2);
    expect(contacts[0]?.phone).toMatch(/^\+234/);

    const search = await server.inject({ method: 'GET', url: '/api/admin/contacts?q=Bola', headers });
    expect(JSON.parse(search.body).contacts).toHaveLength(1);

    const removed = await server.inject({ method: 'DELETE', url: `/api/admin/contacts/${contacts[0]?.id}`, headers });
    expect(JSON.parse(removed.body).deleted).toBe(1);
    expect((server.db.prepare('SELECT COUNT(*) AS c FROM contacts').get() as { c: number }).c).toBe(1);

    const notConfirmed = await server.inject({ method: 'DELETE', url: '/api/admin/contacts', headers });
    expect(notConfirmed.statusCode).toBe(400);
    const cleared = await server.inject({ method: 'DELETE', url: '/api/admin/contacts', headers, payload: { confirm: true } });
    expect(JSON.parse(cleared.body).deleted).toBe(1);
  });

  it('exports a safe CSV of contacts', async () => {
    const server = await app();
    const { cookie } = await adminLogin(server);
    await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: '=HYPERLINK("http://evil","click")', phone: '+2348031234567', consent: true },
    });
    const response = await server.inject({ method: 'GET', url: '/api/admin/export/contacts', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('blaxaura-contacts-');
    expect(response.body.split('\r\n')[0]).toContain('phone_e164');
    expect(response.body).toContain("'=HYPERLINK");
    expect(response.body).not.toContain(',=HYPERLINK');
  });

  it('deletes individual feedback and clears all feedback', async () => {
    const server = await app();
    const { cookie, csrf } = await adminLogin(server);
    const headers = { cookie, 'x-csrf-token': csrf };
    await server.inject({ method: 'POST', url: '/api/feedback', payload: { stars: 4, comment: 'first' } });
    await server.inject({ method: 'POST', url: '/api/feedback', payload: { stars: 2, comment: 'second' } });

    const list = await server.inject({ method: 'GET', url: '/api/admin/feedback', headers });
    const rows = JSON.parse(list.body).feedback as { id: number }[];
    expect(rows).toHaveLength(2);

    await server.inject({ method: 'DELETE', url: `/api/admin/feedback/${rows[0]?.id}`, headers });
    expect((server.db.prepare('SELECT COUNT(*) AS c FROM feedback').get() as { c: number }).c).toBe(1);

    const cleared = await server.inject({ method: 'DELETE', url: '/api/admin/feedback', headers, payload: { confirm: true } });
    expect(JSON.parse(cleared.body).deleted).toBe(1);
    expect((server.db.prepare('SELECT COUNT(*) AS c FROM feedback').get() as { c: number }).c).toBe(0);
  });

  it('purges data older than a retention window', async () => {
    const server = await app();
    const { cookie, csrf } = await adminLogin(server);
    const headers = { cookie, 'x-csrf-token': csrf };
    await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: 'Old', phone: '+2348031234567', consent: true },
    });
    server.db.prepare('UPDATE contacts SET created_at = ?').run(new Date(Date.now() - 90 * 864e5).toISOString());
    await server.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: 'New', phone: '+2348098765432', consent: true },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/retention/purge',
      headers,
      payload: { olderThanDays: 30 },
    });
    expect(response.statusCode).toBe(200);
    const rows = server.db.prepare('SELECT display_name FROM contacts').all() as { display_name: string }[];
    expect(rows.map((row) => row.display_name)).toEqual(['New']);
  });
});

describe('persistence', () => {
  it('survives a restart and keeps deletions deleted', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'blaxaura-test-'));
    dirs.push(dir);
    const databasePath = path.join(dir, 'test.sqlite');

    const first = await makeApp({ databasePath });
    apps.push(first.app);
    const { cookie, csrf } = await adminLogin(first.app);
    await first.app.inject({
      method: 'POST',
      url: '/api/contacts',
      payload: { displayName: 'Persisted', phone: '+2348031234567', consent: true },
    });
    await first.app.inject({ method: 'POST', url: '/api/feedback', payload: { stars: 5, comment: 'kept' } });
    await first.app.close();
    apps.pop();

    const second = await makeApp({ databasePath });
    apps.push(second.app);
    const contacts = await second.app.inject({ method: 'GET', url: '/api/admin/contacts', headers: { cookie } });
    expect(JSON.parse(contacts.body).contacts).toHaveLength(1);
    const feedback = await second.app.inject({ method: 'GET', url: '/api/admin/feedback', headers: { cookie } });
    expect(JSON.parse(feedback.body).feedback).toHaveLength(1);

    const list = JSON.parse(contacts.body).contacts as { id: number }[];
    await second.app.inject({ method: 'DELETE', url: `/api/admin/contacts/${list[0]?.id}`, headers: { cookie, 'x-csrf-token': csrf } });
    await second.app.close();
    apps.pop();

    const third = await makeApp({ databasePath });
    apps.push(third.app);
    const after = await third.app.inject({ method: 'GET', url: '/api/admin/contacts', headers: { cookie } });
    expect(JSON.parse(after.body).contacts).toHaveLength(0);
  });
});
