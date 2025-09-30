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

  try {
    const response = await fetcher<ActiveSessionsResponse>('/sessions/active');
    let games: GameDetails[] = [];
    try {
      games = await fetcher<GameDetails[]>('/admin/games');
    } catch (error) {
      console.error('Failed to load games for quick start', error);
    }
    return { pageTitle: 'Game Runner', sessions: response.sessions, generatedAt: response.generatedAt, games };
  } catch (error) {
    console.error('Failed to load active sessions', error);
    return {
      pageTitle: 'Game Runner',
      sessions: [],
      generatedAt: null,
      sessionsError: 'Unable to load active sessions from Fastify mock API.',
      games: []
    };
  }
};
