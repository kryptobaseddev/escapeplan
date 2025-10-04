import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';

export const load: LayoutServerLoad = async (event) => {
  const { locals } = event;

  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const apiFetch = makeServerFetcher(event);

  // Load system settings for global access
  let businessSettings = {};
  try {
    const settingsResponse = await apiFetch<{ settings: any }>('/admin/settings');
    businessSettings = settingsResponse.settings?.business || {};
  } catch (error) {
    console.error('Failed to load business settings in layout:', error);
  }

  return {
    user: locals.user,
    session: locals.session,
    canViewCameras: locals.user.permissions?.includes('view_cameras') ?? false,
    canManageCameras: locals.user.permissions?.includes('manage_cameras') ?? false,
    businessSettings
  };
};
