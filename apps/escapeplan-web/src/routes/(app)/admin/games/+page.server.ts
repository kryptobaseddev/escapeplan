import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { GameDetails, GamePuzzleDefinition, GameRoomDefinition, SaveGameRequest } from '$lib/api/types';

type JsonParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

function parseJsonArray<T>(source: FormDataEntryValue | null, label: string): JsonParseResult<T[]> {
  if (!source) return { ok: true, value: [] };
  try {
    const parsed = JSON.parse(String(source));
    if (!Array.isArray(parsed)) {
      return { ok: false, message: `${label} must be a JSON array.` };
    }
    return { ok: true, value: parsed };
  } catch (err) {
    return { ok: false, message: `${label} must be valid JSON.` };
  }
}

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.permissions?.includes('manage_games')) {
    throw error(403, 'Permission denied');
  }
  const fetcher = makeServerFetcher(event);
  const games = await fetcher<GameDetails[]>('/admin/games');
  return { games };
};

async function buildPayload(form: FormData, requireRooms: boolean) {
  const slug = String(form.get('slug') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const storyIntro = form.get('storyIntro') ? String(form.get('storyIntro')).trim() : undefined;
  const durationMinutes = Number(form.get('durationMinutes'));
  const difficulty = String(form.get('difficulty') ?? '').trim();
  const pricingModel = String(form.get('pricingModel') ?? '').trim();
  const categoriesRaw = String(form.get('categories') ?? '').trim();
  const minPlayers = Number(form.get('minPlayers'));
  const maxPlayers = Number(form.get('maxPlayers'));
  const pricePerPlayerCents = Number(form.get('pricePerPlayerCents'));
  const resourcesRequired = Number(form.get('resourcesRequired'));
  const validationNotes = form.get('validationNotes') ? String(form.get('validationNotes')).trim() : undefined;

  if (!slug || !name || !description || !difficulty || !pricingModel || Number.isNaN(durationMinutes)) {
    return { ok: false as const, message: 'Missing required fields.' };
  }

  const puzzlesJson = parseJsonArray<GamePuzzleDefinition>(form.get('puzzles'), 'Puzzles');
  if (!puzzlesJson.ok) {
    return { ok: false as const, message: puzzlesJson.message };
  }
  const roomsJson = parseJsonArray<GameRoomDefinition>(form.get('rooms'), 'Rooms');
  if (!roomsJson.ok) {
    return { ok: false as const, message: roomsJson.message };
  }
  if (requireRooms && roomsJson.value.length === 0) {
    return { ok: false as const, message: 'At least one room is required.' };
  }

  const payload: SaveGameRequest = {
    slug,
    name,
    description,
    storyIntro,
    durationMinutes,
    difficulty,
    pricingModel,
    categories: categoriesRaw ? categoriesRaw.split(',').map((c) => c.trim()).filter(Boolean) : [],
    minPlayers: Number.isNaN(minPlayers) ? 1 : minPlayers,
    maxPlayers: Number.isNaN(maxPlayers) ? 1 : maxPlayers,
    pricePerPlayerCents: Number.isNaN(pricePerPlayerCents) ? 0 : pricePerPlayerCents,
    resourcesRequired: Number.isNaN(resourcesRequired) ? 1 : resourcesRequired,
    validationNotes,
    puzzles: puzzlesJson.value.map((puzzle, index) => ({
      id: puzzle.id ?? '',
      title: puzzle.title,
      description: puzzle.description,
      solution: puzzle.solution,
      mediaAsset: puzzle.mediaAsset,
      operatorActions: puzzle.operatorActions,
      displayOrder: puzzle.displayOrder ?? index + 1
    })),
    rooms: roomsJson.value.map((room) => ({
      id: room.id ?? '',
      name: room.name,
      isMobileCapable: Boolean(room.isMobileCapable),
      themeToken: room.themeToken
    }))
  };

  return { ok: true as const, payload };
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
    const result = await buildPayload(form, false);
    if (!result.ok) {
      return fail(400, { message: result.message });
    }
    try {
      const fetcher = makeServerFetcher(event);
      await fetcher<GameDetails>(`/admin/games/${gameId}`, {
        method: 'PUT',
        body: JSON.stringify(result.payload)
      });
      throw redirect(303, '/admin/games');
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
    const result = await buildPayload(form, true);
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
      throw redirect(303, '/admin/games');
    } catch (error) {
      console.error('Failed to delete game', error);
      return fail(500, { message: 'Unable to delete game.' });
    }
  }
};
