import type { ServerLoadEvent } from '@sveltejs/kit';
import { apiFetch } from './client';

export function makeServerFetcher(event: Pick<ServerLoadEvent, 'fetch' | 'cookies'>) {
  return async <T>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers ?? {});
    const sessionToken = event.cookies.get('better-auth.session_token');
    if (sessionToken && !headers.has('cookie')) {
      headers.set('cookie', `better-auth.session_token=${sessionToken}`);
    }
    return apiFetch<T>(event.fetch, path, { ...init, headers });
  };
}
