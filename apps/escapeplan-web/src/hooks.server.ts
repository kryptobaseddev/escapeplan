import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { apiFetch } from '$lib/api/client';
import type { AuthSessionEnvelope } from '$lib/api/types';

// URL redirects for migrated admin pages
const ADMIN_REDIRECTS: Record<string, string> = {
  '/admin/network': '/admin/system#network',
  '/admin/storage': '/admin/system#storage',
  '/admin/system/alerts': '/admin/system#alerts',
  '/admin/system/logs': '/admin/system#logs'
};

export const handle: Handle = async ({ event, resolve }) => {
  // Check for admin page redirects
  const redirectTarget = ADMIN_REDIRECTS[event.url.pathname];
  if (redirectTarget) {
    throw redirect(302, redirectTarget);
  }

  event.locals.user = null;
  event.locals.session = null;

  try {
    const cookie = event.request.headers.get('cookie');
    const session = await apiFetch<AuthSessionEnvelope | null>(event.fetch, '/api/auth/get-session', {
      method: 'GET',
      headers: cookie ? { cookie } : undefined
    });
    if (session && session.user && session.session) {
      event.locals.user = session.user;
      event.locals.session = session.session;

      // NOTE: session.user now includes user_type field ('operator' | 'customer')
      // Future: Add route guards to check user_type === 'operator' for operator-only routes
      // For backward compatibility, user_type defaults to 'operator' for existing users
    }
  } catch {
    // unauthenticated is fine
  }

  return resolve(event);
};
