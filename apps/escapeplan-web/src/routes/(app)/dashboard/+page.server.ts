import type { PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { DashboardResponse } from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  const fetcher = makeServerFetcher(event);

  try {
    const dashboard = await fetcher<DashboardResponse>('/dashboard');
    return { pageTitle: 'Dashboard', dashboard };
  } catch (error) {
    console.error('Failed to load dashboard data', error);
    return {
      pageTitle: 'Dashboard',
      dashboard: null,
      dashboardError: 'Unable to reach control API. Check Fastify mocks are running.'
    };
  }
};
