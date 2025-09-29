import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { apiFetch, ApiError } from '$lib/api/client';
import type { LoginResponse } from '$lib/api/types';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '$lib/constants';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    throw redirect(303, '/dashboard');
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
      return fail(400, { message: 'Username and password are required.' });
    }

    try {
      const response = await apiFetch<LoginResponse>(fetch, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      cookies.set(SESSION_COOKIE, response.token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: SESSION_MAX_AGE_SECONDS
      });

      throw redirect(303, '/dashboard');
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
        throw error;
      }
      if (error instanceof ApiError) {
        const message = typeof error.details === 'object' && error.details && 'message' in error.details
          ? String((error.details as { message?: unknown }).message ?? 'Invalid credentials')
          : 'Invalid credentials';
        return fail(error.status ?? 400, { message });
      }

      console.error('Unexpected login error', error);
      return fail(500, { message: 'Unable to sign in right now.' });
    }
  }
};
