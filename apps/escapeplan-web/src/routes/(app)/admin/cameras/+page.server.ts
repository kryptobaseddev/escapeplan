import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type {
  Camera,
  CameraSummary,
  CreateCameraRequest,
  UpdateCameraRequest,
  TestCameraConnectionRequest,
  GameDetails
} from '@escapeplan/contracts';

export const load: PageServerLoad = async (event) => {
  const { locals } = event;

  const canViewCameras = locals.user?.permissions?.includes('view_cameras') ?? false;
  const canManageCameras = locals.user?.permissions?.includes('manage_cameras') ?? false;

  if (!canViewCameras) {
    throw error(403, 'Permission denied');
  }

  const fetcher = makeServerFetcher(event);

  // Load cameras list
  const camerasResponse = await fetcher<{ cameras: CameraSummary[] }>('/admin/cameras');
  const cameras = camerasResponse.cameras;

  // Load games for association dropdown
  const games = await fetcher<GameDetails[]>('/admin/games');

  event.depends('app:admin:cameras');

  return {
    pageTitle: 'Camera Management',
    cameras,
    games,
    canViewCameras,
    canManageCameras
  };
};

export const actions: Actions = {
  delete: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_cameras')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) {
      return fail(400, { message: 'Camera id required.' });
    }

    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<void>(`/admin/cameras/${id}`, {
        method: 'DELETE'
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to delete camera', error);
      return fail(500, { message: 'Unable to delete camera.' });
    }
  }
};
