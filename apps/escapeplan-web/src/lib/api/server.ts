import type { ServerLoadEvent, RequestEvent } from '@sveltejs/kit';
import { apiFetch } from './client';

export function tokenFromEvent(event: Pick<RequestEvent, 'locals'>): string | null {
  return event.locals.sessionToken ?? null;
}

export function makeServerFetcher(event: Pick<ServerLoadEvent, 'fetch' | 'locals'>) {
  return async <T>(path: string, init: RequestInit = {}) =>
    apiFetch<T>(event.fetch, path, { ...init, token: tokenFromEvent(event) });
}

export const withToken = (token?: string | null): RequestInit['headers'] => {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};
