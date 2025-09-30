import type { PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { DashboardResponse, GameDetails } from '$lib/api/types';

export const load: PageServerLoad = async (event) => {
  const user = event.locals.user;
  const canViewDashboard = user?.permissions?.includes('view_dashboard') ?? false;
  if (!canViewDashboard) {
    return {
      pageTitle: 'Dashboard',
      dashboard: null,
      dashboardError: user ? 'You do not have permission to view the dashboard.' : null,
      games: []
    };
  }

  const fetcher = makeServerFetcher(event);

  try {
    const dashboard = await fetcher<DashboardResponse>('/dashboard');
    let games: GameDetails[] = [];
    if (user?.permissions?.includes('manage_sessions')) {
      try {
        games = await fetcher<GameDetails[]>('/admin/games');
      } catch (gamesError) {
        console.error('Failed to load games for quick start', gamesError);
      }
    }
    return { pageTitle: 'Dashboard', dashboard, games };
  } catch (error) {
    console.error('Failed to load dashboard data', error);
    return {
      pageTitle: 'Dashboard',
      dashboard: null,
      dashboardError: 'Unable to reach control API. Check Fastify mocks are running.',
      games: []
    };
  }
};
