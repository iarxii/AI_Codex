import { config } from '../config';
import { getValidToken, clearAuthSession } from './authToken';

/**
 * Safe admin API helper — prevents:
 * - Using expired token (getValidToken)
 * - Unhandled JSON parse on non-JSON errors
 * - "message channel closed" via proper async binding (no chrome.runtime usage)
 * - Leaked fetches on unmount (AbortController)
 */

export class AdminApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function parseErrorBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return res.statusText || `Request failed (${res.status})`;
  try {
    const json = JSON.parse(text);
    return json.detail || json.message || text;
  } catch {
    return text;
  }
}

export type FetchOpts = RequestInit & { signal?: AbortSignal };

export async function adminFetch(path: string, opts: FetchOpts = {}): Promise<Response> {
  const token = getValidToken();
  if (!token) {
    throw new AdminApiError(401, 'Session expired — please log in again');
  }
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> || {}),
    'Authorization': `Bearer ${token}`,
  };
  // Only set JSON content-type if body is present and not already set
  if (opts.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}${path}`, {
    ...opts,
    headers,
  });
  if (res.status === 401) {
    clearAuthSession();
  }
  return res;
}

export async function adminFetchJson<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const res = await adminFetch(path, opts);
  if (!res.ok) {
    const detail = await parseErrorBody(res);
    throw new AdminApiError(res.status, detail);
  }
  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AdminApiError(res.status, 'Invalid JSON response from server');
  }
}

// Convenience typed wrappers — all correctly bound async (no chrome.runtime leaks)
export const AdminApi = {
  listUsers: (signal?: AbortSignal) => adminFetchJson<any[]>('/admin/users', { signal }),
  updateUser: (id: number, updates: Record<string, any>) =>
    adminFetchJson<any>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteUser: (id: number) =>
    adminFetchJson<{ message: string }>(`/admin/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id: number) =>
    adminFetchJson<{ message: string }>(`/admin/users/${id}/reset-password`, { method: 'POST' }),

  listSpaces: (signal?: AbortSignal) => adminFetchJson<any[]>('/spaces/', { signal }),
  createSpace: (payload: Record<string, any>) =>
    adminFetchJson<any>('/admin/spaces', { method: 'POST', body: JSON.stringify(payload) }),
  updateSpace: (id: number, payload: Record<string, any>) =>
    adminFetchJson<any>(`/admin/spaces/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSpace: (id: number) =>
    adminFetchJson<{ message: string }>(`/admin/spaces/${id}`, { method: 'DELETE' }),
  listSpaceAccess: (spaceId: number) =>
    adminFetchJson<any>(`/admin/spaces/${spaceId}/access`),
  grantSpaceAccess: (spaceId: number, userId: number) =>
    adminFetchJson<any>(`/admin/spaces/${spaceId}/access`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  revokeSpaceAccess: (spaceId: number, userId: number) =>
    adminFetchJson<any>(`/admin/spaces/${spaceId}/access/${userId}`, { method: 'DELETE' }),

  getMe: (signal?: AbortSignal) => adminFetchJson<any>('/auth/me', { signal }),
};
