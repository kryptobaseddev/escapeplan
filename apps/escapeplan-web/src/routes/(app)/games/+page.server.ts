import type { PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { ActiveSessionsResponse, GameDetails } from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  const user = event.locals.user;
  if (!user?.permissions?.includes('manage_sessions')) {
    return {
      pageTitle: 'Game Runner',
      sessions: [],
      generatedAt: null,
      sessionsError: user ? 'You do not have permission to control sessions.' : null,
      games: []
    };
  }

  const fetcher = makeServerFetcher(event);
  const url = event.url;
  const status = url.searchParams.get('status') || 'active';
  const search = url.searchParams.get('search') || '';
  const sortBy = (url.searchParams.get('sortBy') as 'date' | 'game' | 'location') || 'date';
  const sortOrder = (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

  try {
    const queryParams = new URLSearchParams({
      ...(status && { status }),
      ...(search && { search }),
      sortBy,
      sortOrder
    });
    const response = await fetcher<ActiveSessionsResponse>(`/sessions?${queryParams.toString()}`);
    let games: GameDetails[] = [];
    try {
      games = await fetcher<GameDetails[]>('/admin/games');
    } catch (error) {
      console.error('Failed to load games for quick start', error);
    }
    return {
      pageTitle: 'Game Runner',
      sessions: response.sessions,
      generatedAt: response.generatedAt,
      games,
      filters: { status, search, sortBy, sortOrder }
    };
  } catch (error) {
    console.error('Failed to load sessions', error);
    return {
      pageTitle: 'Game Runner',
      sessions: [],
      generatedAt: null,
      sessionsError: 'Unable to load sessions from API.',
      games: [],
      filters: { status, search, sortBy, sortOrder }
    };
  }
};
