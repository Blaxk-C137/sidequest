import { readCookie } from '@/lib/utils';
import { ApiError } from '@/lib/api';

export type AdminSession = { configured: boolean; authenticated: boolean; expiresAt: string | null };

export type Stats = {
  sessions: { started: number; completed: number; completionRate: number | null; modes: { report_mode: string; count: number }[] };
  feedback: {
    total: number;
    averageRating: number | null;
    unrated: number;
    distribution: { stars: number; count: number }[];
    topTags: { tag: string; count: number }[];
    recentComments: { id: number; comment: string; stars: number | null; created_at: string }[];
  };
  contacts: { total: number };
};

export type Contact = {
  id: number;
  displayName: string;
  phone: string;
  consentedAt: string;
  consentTextVersion: string;
  createdAt: string;
};

export type FeedbackEntry = {
  id: number;
  stars: number | null;
  tags: string[];
  comment: string | null;
  retryIntent: string | null;
  createdAt: string;
};

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const csrf = readCookie('bx_csrf');
  const mutating = (init.method ?? 'GET').toUpperCase() !== 'GET';
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        ...(mutating && csrf ? { 'x-csrf-token': csrf } : {}),
        ...(init.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the BlaXaura server.');
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
    throw new ApiError(response.status, payload.error ?? 'request_failed', payload.message ?? 'Request failed.');
  }
  return body as T;
}

export const adminApi = {
  session: () => adminRequest<AdminSession>('/api/admin/session'),
  setup: (password: string) =>
    adminRequest<{ ok: boolean; csrfToken: string }>('/api/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  login: (password: string) =>
    adminRequest<{ ok: boolean; csrfToken: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  logout: () => adminRequest<{ ok: boolean }>('/api/admin/logout', { method: 'POST', body: '{}' }),
  stats: () => adminRequest<Stats>('/api/admin/stats'),
  contacts: (query = '') =>
    adminRequest<{ contacts: Contact[] }>(`/api/admin/contacts${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  deleteContact: (id: number) => adminRequest<{ ok: boolean }>(`/api/admin/contacts/${id}`, { method: 'DELETE', body: '{}' }),
  clearContacts: () => adminRequest<{ ok: boolean; deleted: number }>('/api/admin/contacts', { method: 'DELETE', body: JSON.stringify({ confirm: true }) }),
  feedback: () => adminRequest<{ feedback: FeedbackEntry[] }>('/api/admin/feedback'),
  deleteFeedback: (id: number) => adminRequest<{ ok: boolean }>(`/api/admin/feedback/${id}`, { method: 'DELETE', body: '{}' }),
  clearFeedback: () => adminRequest<{ ok: boolean; deleted: number }>('/api/admin/feedback', { method: 'DELETE', body: JSON.stringify({ confirm: true }) }),
  purge: (olderThanDays: number) =>
    adminRequest<{ ok: boolean; contacts: number; feedback: number }>('/api/admin/retention/purge', {
      method: 'POST',
      body: JSON.stringify({ olderThanDays }),
    }),
};
