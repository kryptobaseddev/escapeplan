import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { GameDetails, SaveGameRequest } from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.permissions?.includes('manage_games')) {
    throw error(403, 'Permission denied');
  }
  event.depends('app:admin:games');
  const fetcher = makeServerFetcher(event);
  const games = await fetcher<GameDetails[]>('/admin/games');
  return { games };
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
  update: async (event) => {
    if (!event.locals.user?.permissions?.includes('manage_games')) {
      return fail(403, { message: 'Permission denied.' });
    }
    const form = await event.request.formData();
    const gameId = String(form.get('id') ?? '').trim();
    if (!gameId) {
      return fail(400, { message: 'Missing game identifier.' });
    }
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
      return { success: true };
    } catch (error) {
      console.error('Failed to update game', error);
      return fail(500, { message: 'Unable to update game.' });
    }
  },
  create: async (event) => {
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
      return { success: true };
    } catch (error) {
      console.error('Failed to create game', error);
      return fail(500, { message: 'Unable to create game.' });
    }
  },
  delete: async (event) => {
    if (!event.locals.user?.permissions?.includes('manage_games')) {
      return fail(403, { message: 'Permission denied.' });
    }
    const form = await event.request.formData();
    const gameId = String(form.get('id') ?? '').trim();
    if (!gameId) {
      return fail(400, { message: 'Missing game identifier.' });
    }
    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<void>(`/admin/games/${gameId}`, {
        method: 'DELETE'
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to delete game', error);
      return fail(500, { message: 'Unable to delete game.' });
    }
  }
};
