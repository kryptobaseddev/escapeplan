import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { OperatorProfile, UpdateOwnProfileRequest } from '$lib/api/types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  return {
    pageTitle: 'Account Profile',
    profile: locals.user
  };
};

export const actions: Actions = {
  update: async (event) => {
    const { locals, request } = event;
    if (!locals.user) {
      return fail(401, { message: 'Session expired.' });
    }

    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const emailRaw = form.get('email');
    const avatarConfigRaw = form.get('avatarConfig');
    const bioRaw = form.get('bio');

    if (!name) {
      return fail(400, { message: 'Display name is required.' });
    }

    let avatarConfig;
    if (avatarConfigRaw) {
      try {
        avatarConfig = JSON.parse(String(avatarConfigRaw));
      } catch {
        return fail(400, { message: 'Invalid avatar configuration.' });
      }
    }

    const payload: UpdateOwnProfileRequest = {
      name,
      email: emailRaw ? (String(emailRaw).trim() || null) : null,
      avatarConfig: avatarConfig ?? null,
      bio: bioRaw ? (String(bioRaw).trim() || null) : null
    };

    try {
      const fetcher = makeServerFetcher(event);
      const profile = await fetcher<OperatorProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      locals.user = { ...locals.user, ...profile };
      return { success: true, profile };
    } catch (error) {
      console.error('Failed to update profile', error);
      return fail(400, { message: 'Unable to update profile. Verify inputs and try again.' });
    }
  }
};
