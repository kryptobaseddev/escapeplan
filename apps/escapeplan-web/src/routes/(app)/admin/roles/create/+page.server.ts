import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type {
  CreateRoleRequest,
  GetPermissionsResponse
} from '@escapeplan/contracts';

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.permissions?.includes('manage_roles')) {
    throw error(403, 'Permission denied');
  }

  const fetcher = makeServerFetcher(event);

  // Load all permissions for checkboxes
  const permissionsData = await fetcher<GetPermissionsResponse>('/admin/permissions');

  return {
    permissions: permissionsData.permissions || []
  };
};

export const actions: Actions = {
  default: async (event) => {
    if (!event.locals.user?.permissions?.includes('manage_roles')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await event.request.formData();

    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const permissionIdsRaw = String(form.get('permissionIds') ?? '[]');

    let permissionIds: string[] = [];
    try {
      permissionIds = JSON.parse(permissionIdsRaw);
    } catch (e) {
      return fail(400, { message: 'Invalid permissions data.' });
    }

    if (!name) {
      return fail(400, { message: 'Role name is required.' });
    }

    if (permissionIds.length === 0) {
      return fail(400, { message: 'At least one permission must be selected.' });
    }

    const payload: CreateRoleRequest = {
      name,
      description: description || null,
      permissionIds
    };

    try {
      const fetcher = makeServerFetcher(event);
      await fetcher('/admin/roles', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      throw redirect(303, '/admin/users?tab=roles');
    } catch (err) {
      if (err instanceof Response && err.status === 303) {
        throw err; // Re-throw redirect
      }
      console.error('Failed to create role', err);
      return fail(500, { message: 'Unable to create role.' });
    }
  }
};
