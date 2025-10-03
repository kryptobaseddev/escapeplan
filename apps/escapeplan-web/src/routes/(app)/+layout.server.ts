import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  return {
    user: locals.user,
    session: locals.session,
    canViewCameras: locals.user.permissions?.includes('view_cameras') ?? false,
    canManageCameras: locals.user.permissions?.includes('manage_cameras') ?? false
  };
};
