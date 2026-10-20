import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateFallbackReport } from '@blaxaura/shared';
import { api, ApiError } from './api';

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('validates the report payload before handing it to the UI', async () => {
    const report = generateFallbackReport({ energy: 'chic' });
    mockFetch({ report, sessionId: '11111111-1111-4111-8111-111111111111' });
    const result = await api.createReport({ energy: 'chic' }, null);
    expect(result.report.archetype).toBe(report.archetype);
    expect(result.report.mode).toBe('fallback');
  });

  it('rejects a malformed report instead of rendering it', async () => {
    mockFetch({ report: { archetype: 'x' }, sessionId: 'abc' });
    await expect(api.createReport({}, null)).rejects.toBeInstanceOf(Error);
  });

  it('surfaces server error codes and messages', async () => {
    mockFetch({ error: 'consent_required', message: 'Consent is required.' }, 400);
    await expect(api.saveContact({ displayName: 'Ada', phone: '0803', consent: true })).rejects.toMatchObject({
      status: 400,
      code: 'consent_required',
      message: 'Consent is required.',
    });
  });

  it('reports offline servers as a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('failed to fetch');
      }),
    );
    const error = await api.startSession().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });
});
