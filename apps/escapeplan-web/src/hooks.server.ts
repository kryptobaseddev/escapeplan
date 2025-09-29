import type { Handle } from '@sveltejs/kit';
import { apiFetch } from '$lib/api/client';
import type { SessionResponse } from '$lib/api/types';
import { SESSION_COOKIE } from '$lib/constants';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.sessionToken = null;

  const token = event.cookies.get(SESSION_COOKIE);
  if (token) {
    event.locals.sessionToken = token;
    try {
      const session = await apiFetch<SessionResponse>(event.fetch, '/auth/session', {
        headers: { Authorization: `Bearer ${token}` }
      });
      event.locals.user = session.user;
    } catch (error) {
      console.warn('Session validation failed', error);
      event.cookies.delete(SESSION_COOKIE, { path: '/' });
      event.locals.user = null;
      event.locals.sessionToken = null;
    }
  }

  return resolve(event);
};
