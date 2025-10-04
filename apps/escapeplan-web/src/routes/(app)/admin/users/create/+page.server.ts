import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type {
  BotttsAvatarConfig,
  CreateOperatorRequest,
  OperatorSummary
} from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.permissions?.includes('manage_users')) {
    throw error(403, 'Permission denied');
  }

  return {
    canAssignAdmin: event.locals.user?.role === 'admin'
  };
};

export const actions: Actions = {
  create: async (event) => {
    if (!event.locals.user?.permissions?.includes('manage_users')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await event.request.formData();

    const emailInput = form.get('email');
    const email = typeof emailInput === 'string' ? emailInput.trim() : undefined;

    const rawAvatarConfig = form.get('avatarConfig');
    let avatarConfig: BotttsAvatarConfig | undefined;
    if (typeof rawAvatarConfig === 'string' && rawAvatarConfig.trim().length) {
      try {
        avatarConfig = JSON.parse(rawAvatarConfig) as BotttsAvatarConfig;
      } catch (err) {
        console.error('Invalid avatar config payload', err);
        return fail(400, { message: 'Invalid avatar configuration.' });
      }
    }

    const payload: CreateOperatorRequest = {
      username: String(form.get('username') ?? '').trim(),
      name: String(form.get('name') ?? '').trim(),
      role: String(form.get('role') ?? 'game_master') as CreateOperatorRequest['role'],
      password: String(form.get('password') ?? '').trim(),
      email: email && email.length ? email : undefined,
      bio: (() => {
        const raw = form.get('bio');
        if (!raw) return undefined;
        const value = String(raw).trim();
        return value ? value : undefined;
      })(),
      mustResetPassword: form.get('mustResetPassword') === 'on',
      avatarConfig
    };

    if (!payload.username || !payload.name || !payload.password) {
      return fail(400, { message: 'Username, name, and password are required.' });
    }

    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<OperatorSummary>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      throw redirect(303, '/admin/users');
    } catch (err) {
      if (err instanceof Response && err.status === 303) {
        throw err; // Re-throw redirect
      }
      console.error('Failed to create operator', err);
      return fail(500, { message: 'Unable to create user.' });
    }
  }
};
