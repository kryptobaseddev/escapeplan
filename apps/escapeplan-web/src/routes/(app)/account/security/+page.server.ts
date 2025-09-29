import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }
  return { pageTitle: 'Account Security', user: locals.user };
};

export const actions: Actions = {
  change: async (event) => {
    const { locals, request } = event;
    if (!locals.user) {
      return fail(401, { message: 'Session expired.' });
    }

    const form = await request.formData();
    const currentPassword = String(form.get('currentPassword') ?? '').trim();
    const newPassword = String(form.get('newPassword') ?? '').trim();

    if (!currentPassword || !newPassword) {
      return fail(400, { message: 'Both fields are required.' });
    }
    if (newPassword.length < 12) {
      return fail(400, { message: 'New password must be at least 12 characters.' });
    }

    try {
      const fetcher = makeServerFetcher(event);
      await fetcher('/users/me/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to change password', error);
      return fail(400, { message: 'Unable to update password. Check your current password and try again.' });
    }
  }
};
