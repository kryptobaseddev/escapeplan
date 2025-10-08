import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiBase } from '$lib/api/client';

export const POST: RequestHandler = async (event) => {
  try {
    const cookie = event.cookies.get('better-auth.session_token');
    await event.fetch(`${apiBase}/auth/sign-out`, {
      method: 'POST',
      headers: cookie ? { cookie: `better-auth.session_token=${cookie}` } : undefined
    });
  } catch (error) {
    console.warn('Failed to sign out cleanly', error);
  }

  event.cookies.delete('better-auth.session_token', { path: '/' });
  throw redirect(303, '/login');
};
