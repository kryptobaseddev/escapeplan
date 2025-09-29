import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { SESSION_COOKIE } from '$lib/constants';

export const actions: Actions = {
  default: async ({ cookies }) => {
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw redirect(303, '/login');
  }
};

export const load: PageServerLoad = async () => {
  throw redirect(303, '/login');
};
