import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type {
  BotttsAvatarConfig,
  UpdateOperatorRequest,
  OperatorSummary
} from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.permissions?.includes('manage_users')) {
    throw error(403, 'Permission denied');
  }

  const userId = event.params.id;
  if (!userId) {
    throw error(400, 'User ID is required');
  }

  try {
    const fetcher = makeServerFetcher(event);
    const user = await fetcher<OperatorSummary>(`/admin/users/${userId}`, {
      method: 'GET'
    });

    return {
      user,
      canAssignAdmin: event.locals.user?.role === 'admin'
    };
  } catch (err) {
    console.error('Failed to load user', err);
    throw error(404, 'User not found');
  }
};

export const actions: Actions = {
  update: async (event) => {
    if (!event.locals.user?.permissions?.includes('manage_users')) {
      return fail(403, { message: 'Permission denied' });
    }

    const userId = event.params.id;
    if (!userId) {
      return fail(400, { message: 'User ID is required.' });
    }

    const form = await event.request.formData();

    const payload: UpdateOperatorRequest = {
      name: form.get('name') ? String(form.get('name')).trim() : undefined,
      role: form.get('role') ? (String(form.get('role')) as UpdateOperatorRequest['role']) : undefined,
      bio: form.has('bio')
        ? (() => {
            const value = String(form.get('bio') ?? '').trim();
            return value ? value : null;
          })()
        : undefined,
      mustResetPassword: form.get('mustResetPassword') === 'on'
    };

    const rawAvatarConfig = form.get('avatarConfig');
    if (typeof rawAvatarConfig === 'string' && rawAvatarConfig.trim().length) {
      try {
        payload.avatarConfig = JSON.parse(rawAvatarConfig) as BotttsAvatarConfig;
      } catch (error) {
        console.error('Invalid avatar config payload', error);
        return fail(400, { message: 'Invalid avatar configuration.' });
      }
    }

    if (form.has('email')) {
      const emailValue = String(form.get('email') ?? '').trim();
      payload.email = emailValue ? emailValue : undefined;
    }

    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<OperatorSummary>(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      throw redirect(303, '/admin/users');
    } catch (err) {
      if (err instanceof Response && err.status === 303) {
        throw err; // Re-throw redirect
      }
      console.error('Failed to update operator', err);
      return fail(500, { message: 'Unable to update user.' });
    }
  }
};
