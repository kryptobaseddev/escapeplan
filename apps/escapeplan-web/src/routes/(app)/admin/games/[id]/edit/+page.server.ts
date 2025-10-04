import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { GameDetails, SaveGameRequest } from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.permissions?.includes('manage_games')) {
    throw error(403, 'Permission denied');
  }

  const gameId = event.params.id;
  if (!gameId) {
    throw error(400, 'Game ID is required');
  }

  try {
    const fetcher = makeServerFetcher(event);
    const [game, settingsResponse] = await Promise.all([
      fetcher<GameDetails>(`/admin/games/${gameId}`, {
        method: 'GET'
      }),
      fetcher<{ settings: any }>('/admin/settings', {
        method: 'GET'
      }).catch(() => ({ settings: {} }))
    ]);

    return { game, systemSettings: settingsResponse.settings };
  } catch (err) {
    console.error('Failed to load game', err);
    throw error(404, 'Game not found');
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

    const gameId = event.params.id;
    if (!gameId) {
      return fail(400, { message: 'Game ID is required.' });
    }

    const form = await event.request.formData();
    const result = await buildPayload(form);
    if (!result.ok) {
      return fail(400, { message: result.message });
    }

    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<GameDetails>(`/admin/games/${gameId}`, {
        method: 'PUT',
        body: JSON.stringify(result.payload)
      });
    } catch (err) {
      console.error('Failed to update game - Full error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unable to update game.';
      return fail(500, { message: errorMessage });
    }

    // Success - redirect to games list
    throw redirect(303, '/admin/games');
  }
};
