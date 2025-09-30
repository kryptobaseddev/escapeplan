import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type {
  ArchiveOperatorRequest,
  BotttsAvatarConfig,
  CreateOperatorRequest,
  OperatorSummary,
  ResetOperatorPasswordRequest,
  UpdateOperatorRequest
} from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  const { locals, url } = event;
  if (!locals.user || !locals.user.permissions?.includes('manage_users')) {
    throw error(403, 'Permission denied');
  }

  const fetcher = makeServerFetcher(event);

  const searchParams = new URLSearchParams();
  const search = url.searchParams.get('search')?.trim() ?? '';
  const role = url.searchParams.get('role') ?? 'all';
  const status = url.searchParams.get('status') ?? 'active';

  if (search) searchParams.set('search', search);
  if (role && role !== 'all') searchParams.set('role', role);
  if (status && status !== 'active') searchParams.set('status', status);

  const queryString = searchParams.toString();
  const users = await fetcher<OperatorSummary[]>(`/admin/users${queryString ? `?${queryString}` : ''}`);

  event.depends('app:admin:users');

  return {
    pageTitle: 'User Management',
    users,
    filters: {
      search,
      role,
      status
    },
    roles: ['all', 'admin', 'manager', 'game_master', 'customer'] as const,
    statusOptions: ['active', 'archived', 'all'] as const,
    canAssignAdmin: locals.user?.role === 'admin',
    currentUserId: locals.user?.id ?? null
  };
};

export const actions: Actions = {
  create: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_users')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();
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
      const result = await fetcher<OperatorSummary>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return { success: true, user: result };
    } catch (error) {
      console.error('Failed to create operator', error);
      return fail(500, { message: 'Unable to create user.' });
    }
  },
  update: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_users')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) {
      return fail(400, { message: 'User id required.' });
    }

    const payload: UpdateOperatorRequest = {
      name: form.get('name') ? String(form.get('name')).trim() : undefined,
      role: form.get('role') ? (String(form.get('role')) as UpdateOperatorRequest['role']) : undefined,
      bio:
        form.has('bio')
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
      const result = await fetcher<OperatorSummary>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return { success: true, user: result };
    } catch (error) {
      console.error('Failed to update operator', error);
      return fail(500, { message: 'Unable to update user.' });
    }
  },
  reset: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_users')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    const password = String(form.get('password') ?? '').trim();
    if (!id || !password) {
      return fail(400, { message: 'User id and password required.' });
    }

    const payload: ResetOperatorPasswordRequest = {
      password,
      forceReset: form.get('forceReset') === 'on'
    };

    try {
      const fetcher = makeServerFetcher(event);
      const result = await fetcher<OperatorSummary>(`/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return { success: true, user: result };
    } catch (error) {
      console.error('Failed to reset password', error);
      return fail(500, { message: 'Unable to reset password.' });
    }
  },
  delete: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_users')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) {
      return fail(400, { message: 'User id required.' });
    }

    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<void>(`/admin/users/${id}`, {
        method: 'DELETE'
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to delete operator', error);
      return fail(500, { message: 'Unable to remove user.' });
    }
  },
  archive: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_users')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    const reason = form.has('reason') ? String(form.get('reason') ?? '').trim() : undefined;
    if (!id) {
      return fail(400, { message: 'User id required.' });
    }

    const payload: ArchiveOperatorRequest = {
      reason: reason ? reason : null
    };

    try {
      const fetcher = makeServerFetcher(event);
      const result = await fetcher<OperatorSummary>(`/admin/users/${id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return { success: true, user: result };
    } catch (error) {
      console.error('Failed to archive operator', error);
      return fail(500, { message: 'Unable to archive user.' });
    }
  },
  unarchive: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_users')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) {
      return fail(400, { message: 'User id required.' });
    }

    try {
      const fetcher = makeServerFetcher(event);
      const result = await fetcher<OperatorSummary>(`/admin/users/${id}/unarchive`, {
        method: 'PATCH'
      });
      return { success: true, user: result };
    } catch (error) {
      console.error('Failed to unarchive operator', error);
      return fail(500, { message: 'Unable to restore user.' });
    }
  }
};
