import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type {
  RoleWithPermissions,
  UpdateRoleRequest,
  UpdateRolePermissionsRequest,
  GetPermissionsResponse,
  Permission
} from '@escapeplan/contracts';

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.permissions?.includes('manage_roles')) {
    throw error(403, 'Permission denied');
  }

  const fetcher = makeServerFetcher(event);
  const roleId = event.params.id;

  // Load role by ID
  const role = await fetcher<RoleWithPermissions>(`/admin/roles/${roleId}`);

  // Load all permissions
  const permissionsData = await fetcher<GetPermissionsResponse>('/admin/permissions');

  return {
    role,
    permissions: permissionsData.permissions || [],
    rolePermissions: role.permissions || [] // Permissions this role currently has
  };
};

export const actions: Actions = {
  default: async (event) => {
    if (!event.locals.user?.permissions?.includes('manage_roles')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await event.request.formData();
    const roleId = event.params.id;

    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const permissionIdsRaw = String(form.get('permissionIds') ?? '[]');

    let permissionIds: string[] = [];
    try {
      permissionIds = JSON.parse(permissionIdsRaw);
    } catch (e) {
      return fail(400, { message: 'Invalid permissions data.' });
    }

    if (permissionIds.length === 0) {
      return fail(400, { message: 'At least one permission must be selected.' });
    }

    try {
      const fetcher = makeServerFetcher(event);

      // First, load the role to check if it's a system role
      const role = await fetcher<RoleWithPermissions>(`/admin/roles/${roleId}`);

      // Update role name and description (only for non-system roles)
      if (!role.isSystem) {
        if (!name) {
          return fail(400, { message: 'Role name is required.' });
        }

        const updatePayload: UpdateRoleRequest = {
          name,
          description: description || null
        };

        await fetcher(`/admin/roles/${roleId}`, {
          method: 'PATCH',
          body: JSON.stringify(updatePayload)
        });
      }

      // Update permissions (allowed for both system and custom roles)
      const permPayload: UpdateRolePermissionsRequest = {
        permissionIds
      };

      await fetcher(`/admin/roles/${roleId}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify(permPayload)
      });

      throw redirect(303, '/admin/users?tab=roles');
    } catch (err) {
      if (err instanceof Response && err.status === 303) {
        throw err; // Re-throw redirect
      }
      console.error('Failed to update role', err);
      return fail(500, { message: 'Unable to update role.' });
    }
  }
};
