import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PUBLIC_API_BASE_URL } from '$env/static/public';

const API_BASE = (PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export const actions: Actions = {
  default: async (event) => {
    try {
      const cookie = event.cookies.get('better-auth.session_token');
      await event.fetch(`${API_BASE}/auth/sign-out`, {
        method: 'POST',
        headers: cookie ? { cookie: `better-auth.session_token=${cookie}` } : undefined
      });
    } catch (error) {
      console.warn('Failed to sign out cleanly', error);
    }

    event.cookies.delete('better-auth.session_token', { path: '/' });
    throw redirect(303, '/login');
  }
};

export const load: PageServerLoad = async () => {
  throw redirect(303, '/login');
};
