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
  create: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_cameras')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();

    const payload: CreateCameraRequest = {
      name: String(form.get('name') ?? '').trim(),
      protocol: String(form.get('protocol') ?? 'rtsp') as CreateCameraRequest['protocol'],
      host: String(form.get('host') ?? '').trim(),
      port: Number(form.get('port')) || 554,
      username: form.get('username') ? String(form.get('username')).trim() : undefined,
      password: form.get('password') ? String(form.get('password')).trim() : undefined,
      streamPath: form.get('streamPath') ? String(form.get('streamPath')).trim() : undefined,
      resolution: String(form.get('resolution') ?? '720p') as CreateCameraRequest['resolution'],
      frameRate: Number(form.get('frameRate')) || 15,
      transport: String(form.get('transport') ?? 'tcp') as CreateCameraRequest['transport'],
      gameId: form.get('gameId') ? String(form.get('gameId')).trim() : undefined
    };

    if (!payload.name || !payload.host) {
      return fail(400, { message: 'Name and host are required.' });
    }

    try {
      const fetcher = makeServerFetcher(event);
      const result = await fetcher<Camera>('/admin/cameras', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return { success: true, camera: result };
    } catch (error) {
      console.error('Failed to create camera', error);
      return fail(500, { message: 'Unable to create camera.' });
    }
  },

  update: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_cameras')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) {
      return fail(400, { message: 'Camera id required.' });
    }

    const payload: UpdateCameraRequest = {
      name: form.get('name') ? String(form.get('name')).trim() : undefined,
      protocol: form.get('protocol')
        ? (String(form.get('protocol')) as UpdateCameraRequest['protocol'])
        : undefined,
      host: form.get('host') ? String(form.get('host')).trim() : undefined,
      port: form.has('port') ? Number(form.get('port')) : undefined,
      username: form.has('username')
        ? String(form.get('username') ?? '').trim() || undefined
        : undefined,
      password: form.has('password')
        ? String(form.get('password') ?? '').trim() || undefined
        : undefined,
      streamPath: form.has('streamPath')
        ? String(form.get('streamPath') ?? '').trim() || undefined
        : undefined,
      resolution: form.get('resolution')
        ? (String(form.get('resolution')) as UpdateCameraRequest['resolution'])
        : undefined,
      frameRate: form.has('frameRate') ? Number(form.get('frameRate')) : undefined,
      transport: form.get('transport')
        ? (String(form.get('transport')) as UpdateCameraRequest['transport'])
        : undefined,
      gameId: form.has('gameId')
        ? String(form.get('gameId') ?? '').trim() || null
        : undefined
    };

    try {
      const fetcher = makeServerFetcher(event);
      const result = await fetcher<Camera>(`/admin/cameras/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return { success: true, camera: result };
    } catch (error) {
      console.error('Failed to update camera', error);
      return fail(500, { message: 'Unable to update camera.' });
    }
  },

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
  },

  testConnection: async (event) => {
    const { request, locals } = event;
    if (!locals.user?.permissions?.includes('manage_cameras')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await request.formData();

    const payload: TestCameraConnectionRequest = {
      protocol: String(form.get('protocol') ?? 'rtsp') as TestCameraConnectionRequest['protocol'],
      host: String(form.get('host') ?? '').trim(),
      port: Number(form.get('port')) || 554,
      username: form.get('username') ? String(form.get('username')).trim() : undefined,
      password: form.get('password') ? String(form.get('password')).trim() : undefined,
      streamPath: form.get('streamPath') ? String(form.get('streamPath')).trim() : undefined
    };

    if (!payload.host) {
      return fail(400, { message: 'Host is required.' });
    }

    try {
      const fetcher = makeServerFetcher(event);
      const result = await fetcher<{ success: boolean; errorMessage?: string; diagnostics: any }>(
        '/admin/cameras/test-connection',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      );
      return { success: true, testResult: result };
    } catch (error) {
      console.error('Connection test failed', error);
      return fail(500, { message: 'Unable to test connection.' });
    }
  }
};
