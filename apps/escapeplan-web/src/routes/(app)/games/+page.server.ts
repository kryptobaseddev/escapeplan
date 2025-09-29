import type { PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { ActiveSessionsResponse } from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  const fetcher = makeServerFetcher(event);

  try {
    const response = await fetcher<ActiveSessionsResponse>('/sessions/active');
    return { pageTitle: 'Game Runner', sessions: response.sessions, generatedAt: response.generatedAt };
  } catch (error) {
    console.error('Failed to load active sessions', error);
    return {
      pageTitle: 'Game Runner',
      sessions: [],
      generatedAt: null,
      sessionsError: 'Unable to load active sessions from Fastify mock API.'
    };
  }
};
