import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type {
  Camera,
  UpdateCameraRequest,
  TestCameraConnectionRequest,
  GameDetails,
  CameraTemplatesResponse
} from '@escapeplan/contracts';

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.permissions?.includes('manage_cameras')) {
    throw error(403, 'Permission denied');
  }

  const cameraId = event.params.id;
  if (!cameraId) {
    throw error(400, 'Camera ID is required');
  }

  try {
    const fetcher = makeServerFetcher(event);
    const [camera, games, templates] = await Promise.all([
      fetcher<Camera>(`/admin/cameras/${cameraId}`, { method: 'GET' }),
      fetcher<GameDetails[]>('/admin/games'),
      fetcher<CameraTemplatesResponse>('/admin/cameras/templates')
    ]);

    return { camera, games, templates };
  } catch (err) {
    console.error('Failed to load camera', err);
    throw error(404, 'Camera not found');
  }
};

export const actions: Actions = {
  default: async (event) => {
    if (!event.locals.user?.permissions?.includes('manage_cameras')) {
      return fail(403, { message: 'Permission denied' });
    }

    const cameraId = event.params.id;
    if (!cameraId) {
      return fail(400, { message: 'Camera ID is required.' });
    }

    const form = await event.request.formData();

    const payload: UpdateCameraRequest = {
      name: form.get('name') ? String(form.get('name')).trim() : undefined,
      brand: form.get('brand') ? (String(form.get('brand')) as UpdateCameraRequest['brand']) : undefined,
      model: form.has('model') ? String(form.get('model') ?? '').trim() || undefined : undefined,
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

      // Dual stream support
      mainStreamPath: form.has('mainStreamPath')
        ? String(form.get('mainStreamPath') ?? '').trim() || undefined
        : undefined,
      subStreamPath: form.has('subStreamPath')
        ? String(form.get('subStreamPath') ?? '').trim() || undefined
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

      // Camera capabilities
      hasPtz: form.has('hasPtz') ? form.get('hasPtz') === 'true' : undefined,
      hasAudio: form.has('hasAudio') ? form.get('hasAudio') === 'true' : undefined,
      hasIrControl: form.has('hasIrControl') ? form.get('hasIrControl') === 'true' : undefined,

      // Feature settings
      irMode: form.get('irMode') ? (String(form.get('irMode')) as 'auto' | 'on' | 'off') : undefined,
      audioVolume: form.has('audioVolume') ? Number(form.get('audioVolume')) : undefined,
      ptzPan: form.has('ptzPan') ? Number(form.get('ptzPan')) : undefined,
      ptzTilt: form.has('ptzTilt') ? Number(form.get('ptzTilt')) : undefined,
      ptzZoom: form.has('ptzZoom') ? Number(form.get('ptzZoom')) : undefined,

      gameId: form.has('gameId')
        ? String(form.get('gameId') ?? '').trim() || null
        : undefined
    };

    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<Camera>(`/admin/cameras/${cameraId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      throw redirect(303, '/admin/cameras');
    } catch (err) {
      if (err instanceof Response && err.status === 303) {
        throw err; // Re-throw redirect
      }
      console.error('Failed to update camera', err);
      return fail(500, { message: 'Unable to update camera.' });
    }
  },

  testConnection: async (event) => {
    if (!event.locals.user?.permissions?.includes('manage_cameras')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await event.request.formData();

    const payload: TestCameraConnectionRequest = {
      protocol: String(form.get('protocol') ?? 'rtsp') as TestCameraConnectionRequest['protocol'],
      host: String(form.get('host') ?? '').trim(),
      port: Number(form.get('port')) || 554,
      username: form.get('username') ? String(form.get('username')).trim() : undefined,
      password: form.get('password') ? String(form.get('password')).trim() : undefined,
      streamPath: form.get('mainStreamPath')
        ? String(form.get('mainStreamPath')).trim()
        : form.get('streamPath')
          ? String(form.get('streamPath')).trim()
          : undefined
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
