import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type {
  CreateOperatorRequest,
  OperatorSummary,
  ResetOperatorPasswordRequest,
  UpdateOperatorRequest
} from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  const { locals } = event;
  if (!locals.user || !locals.user.permissions?.includes('manage_users')) {
    throw error(403, 'Permission denied');
  }

  const fetcher = makeServerFetcher(event);
  const users = await fetcher<OperatorSummary[]>('/admin/users');

  return {
    pageTitle: 'User Management',
    users
  };
};

export const actions: Actions = {
  create: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_users')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();
    const payload: CreateOperatorRequest = {
      username: String(form.get('username') ?? '').trim(),
      name: String(form.get('name') ?? '').trim(),
      role: String(form.get('role') ?? 'game_master') as CreateOperatorRequest['role'],
      password: String(form.get('password') ?? '').trim(),
      email: (() => {
        const raw = form.get('email');
        if (!raw) return undefined;
        const value = String(raw).trim();
        return value ? value : undefined;
      })(),
      avatarUrl: (() => {
        const raw = form.get('avatarUrl');
        if (!raw) return undefined;
        const value = String(raw).trim();
        return value ? value : undefined;
      })(),
      bio: (() => {
        const raw = form.get('bio');
        if (!raw) return undefined;
        const value = String(raw).trim();
        return value ? value : undefined;
      })(),
      mustResetPassword: form.get('mustResetPassword') === 'on'
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
      email: form.get('email') ? String(form.get('email')).trim() : undefined,
      avatarUrl:
        form.has('avatarUrl')
          ? (() => {
              const value = String(form.get('avatarUrl') ?? '').trim();
              return value ? value : null;
            })()
          : undefined,
      bio:
        form.has('bio')
          ? (() => {
              const value = String(form.get('bio') ?? '').trim();
              return value ? value : null;
            })()
          : undefined,
      mustResetPassword: form.get('mustResetPassword') === 'on'
    };

    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<OperatorSummary>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      throw redirect(303, '/admin/users');
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
      await fetcher<OperatorSummary>(`/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      throw redirect(303, '/admin/users');
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
      throw redirect(303, '/admin/users');
    } catch (error) {
      console.error('Failed to delete operator', error);
      return fail(500, { message: 'Unable to remove user.' });
    }
  }
};
