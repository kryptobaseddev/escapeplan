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

  const fetcher = makeServerFetcher(event);

  // Fetch user validation settings
  let userValidationSettings = {
    email_required: true,
    password_min_length: 12,
    password_max_length: 128,
    capitalize_display_name: true,
    default_role: 'game_master'
  };

  try {
    const settings = await fetcher<{
      email_required: boolean;
      password_min_length: number;
      password_max_length: number;
      capitalize_display_name: boolean;
      default_role: string;
    }>('/admin/settings?category=user_validation');
    userValidationSettings = settings;
  } catch (err) {
    console.error('Failed to fetch user validation settings, using defaults:', err);
  }

  return {
    canAssignAdmin: event.locals.user?.role === 'admin',
    userValidationSettings
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

    const fetcher = makeServerFetcher(event);

    try {
      await fetcher<OperatorSummary>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err: any) {
      console.error('Failed to create operator', err);
      const message = err?.details?.message || err?.message || 'Unable to create user.';
      return fail(err?.status || 500, { message });
    }

    throw redirect(303, '/admin/users');
  }
};
