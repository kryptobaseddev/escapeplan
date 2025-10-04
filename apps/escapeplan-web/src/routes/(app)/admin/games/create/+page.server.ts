import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { GameDetails, SaveGameRequest } from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.permissions?.includes('manage_games')) {
    throw error(403, 'Permission denied');
  }

  try {
    const fetcher = makeServerFetcher(event);
    const settingsResponse = await fetcher<{ settings: any }>('/admin/settings', {
      method: 'GET'
    }).catch(() => ({ settings: {} }));

    return { systemSettings: settingsResponse.settings };
  } catch (err) {
    console.error('Failed to load system settings', err);
    return { systemSettings: {} };
  }
};

async function buildPayload(form: FormData) {
  const rawPayload = form.get('payload');
  if (typeof rawPayload !== 'string' || rawPayload.trim().length === 0) {
    return { ok: false as const, message: 'Missing payload.' };
  }

  try {
    const parsed = JSON.parse(rawPayload) as SaveGameRequest;
    if (!parsed.slug || !parsed.name || !parsed.description) {
      return { ok: false as const, message: 'Missing required fields.' };
    }
    return { ok: true as const, payload: parsed };
  } catch (error) {
    console.error('Failed to parse game payload', error);
    return { ok: false as const, message: 'Invalid payload format.' };
  }
}

export const actions: Actions = {
  default: async (event) => {
    if (!event.locals.user?.permissions?.includes('manage_games')) {
      return fail(403, { message: 'Permission denied.' });
    }
    const form = await event.request.formData();
    const result = await buildPayload(form);
    if (!result.ok) {
      return fail(400, { message: result.message });
    }
    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<GameDetails>('/admin/games', {
        method: 'POST',
        body: JSON.stringify(result.payload)
      });
      throw redirect(303, '/admin/games');
    } catch (err) {
      if (err instanceof Response && err.status === 303) {
        throw err; // Re-throw redirect
      }
      console.error('Failed to create game', err);
      return fail(500, { message: 'Unable to create game.' });
    }
  }
};
