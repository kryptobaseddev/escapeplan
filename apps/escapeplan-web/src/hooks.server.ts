import type { Handle } from '@sveltejs/kit';
import { apiFetch } from '$lib/api/client';
import type { AuthSessionEnvelope } from '$lib/api/types';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.session = null;

  try {
    const cookie = event.request.headers.get('cookie');
    const session = await apiFetch<AuthSessionEnvelope | null>(event.fetch, '/auth/get-session', {
      method: 'GET',
      headers: cookie ? { cookie } : undefined
    });
    if (session && session.user && session.session) {
      event.locals.user = session.user;
      event.locals.session = session.session;
    }
  } catch {
    // unauthenticated is fine
  }

  return resolve(event);
};
