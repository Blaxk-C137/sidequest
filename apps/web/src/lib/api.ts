import { reportSchema, type Report } from '@blaxaura/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the BlaXaura app on this device. Check that the server is running.');
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const payload = (body ?? {}) as { error?: string; message?: string };
    throw new ApiError(response.status, payload.error ?? 'request_failed', payload.message ?? 'Something went wrong.');
  }
  return body as T;
}

export const api = {
  async startSession(): Promise<string> {
    const body = await request<{ sessionId: string }>('/api/session/start', { method: 'POST', body: '{}' });
    return body.sessionId;
  },

  async createReport(answers: Record<string, string>, sessionId: string | null): Promise<{ report: Report; sessionId: string }> {
    const body = await request<{ report: unknown; sessionId: string }>('/api/report', {
      method: 'POST',
      body: JSON.stringify({ answers, ...(sessionId ? { sessionId } : {}) }),
    });
    return { report: reportSchema.parse(body.report), sessionId: body.sessionId };
  },

  async sendFeedback(input: {
    sessionId: string | null;
    stars: number | null;
    tags: string[];
    comment: string | null;
    retryIntent: 'yes' | 'maybe' | 'no' | null;
  }): Promise<void> {
    await request('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        stars: input.stars,
        tags: input.tags,
        comment: input.comment,
        retryIntent: input.retryIntent,
      }),
    });
  },

  async saveContact(input: { displayName: string; phone: string; consent: true }): Promise<void> {
    await request('/api/contacts', { method: 'POST', body: JSON.stringify(input) });
  },
};
