import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type {
  Camera,
  CreateCameraRequest,
  TestCameraConnectionRequest,
  GameDetails,
  CameraTemplatesResponse
} from '@escapeplan/contracts';

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.permissions?.includes('manage_cameras')) {
    throw error(403, 'Permission denied');
  }

  const fetcher = makeServerFetcher(event);
  const [games, templates] = await Promise.all([
    fetcher<GameDetails[]>('/admin/games'),
    fetcher<CameraTemplatesResponse>('/admin/cameras/templates')
  ]);

  return { games, templates };
};

export const actions: Actions = {
  create: async (event) => {
    if (!event.locals.user?.permissions?.includes('manage_cameras')) {
      return fail(403, { message: 'Permission denied' });
    }

    const form = await event.request.formData();

    const payload: CreateCameraRequest = {
      name: String(form.get('name') ?? '').trim(),
      brand: String(form.get('brand') ?? 'generic') as CreateCameraRequest['brand'],
      model: form.get('model') ? String(form.get('model')).trim() : undefined,
      protocol: String(form.get('protocol') ?? 'rtsp') as CreateCameraRequest['protocol'],
      host: String(form.get('host') ?? '').trim(),
      port: Number(form.get('port')) || 554,
      username: form.get('username') ? String(form.get('username')).trim() : undefined,
      password: form.get('password') ? String(form.get('password')).trim() : undefined,

      // Dual stream support
      mainStreamPath: form.get('mainStreamPath') ? String(form.get('mainStreamPath')).trim() : undefined,
      subStreamPath: form.get('subStreamPath') ? String(form.get('subStreamPath')).trim() : undefined,
      streamPath: form.get('streamPath') ? String(form.get('streamPath')).trim() : undefined, // Legacy fallback

      resolution: String(form.get('resolution') ?? '720p') as CreateCameraRequest['resolution'],
      frameRate: Number(form.get('frameRate')) || 15,
      transport: String(form.get('transport') ?? 'tcp') as CreateCameraRequest['transport'],

      // Camera capabilities
      hasPtz: form.get('hasPtz') === 'true',
      hasAudio: form.get('hasAudio') === 'true',
      hasIrControl: form.get('hasIrControl') === 'true',

      // Feature settings
      irMode: form.get('irMode') ? String(form.get('irMode')) as 'auto' | 'on' | 'off' : 'auto',
      audioVolume: form.get('audioVolume') ? Number(form.get('audioVolume')) : 50,

      gameId: form.get('gameId') ? String(form.get('gameId')).trim() : undefined
    };

    if (!payload.name || !payload.host) {
      return fail(400, { message: 'Name and host are required.' });
    }

    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<Camera>('/admin/cameras', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      throw redirect(303, '/admin/cameras');
    } catch (err) {
      if (err instanceof Response && err.status === 303) {
        throw err; // Re-throw redirect
      }
      console.error('Failed to create camera', err);
      return fail(500, { message: 'Unable to create camera.' });
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
