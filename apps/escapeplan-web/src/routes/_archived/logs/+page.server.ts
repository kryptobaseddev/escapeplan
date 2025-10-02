import type { PageServerLoad } from './$types';
import type { GetSystemLogsResponse } from '@escapeplan/contracts';

export const load: PageServerLoad = async ({ fetch, url }) => {
  try {
    const params = new URLSearchParams({
      limit: '100',
      offset: '0'
    });

    const level = url.searchParams.get('level');
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1', 10);

    if (level && level !== 'all') params.set('level', level);
    if (category && category !== 'all') params.set('category', category);
    if (search) params.set('search', search);

    params.set('offset', ((page - 1) * 100).toString());

    const response = await fetch(`/api/admin/logs?${params}`);
    if (!response.ok) {
      return {
        logs: [],
        total: 0,
        page,
        error: `Failed to load logs: ${response.statusText}`
      };
    }

    const data: GetSystemLogsResponse = await response.json();
    return {
      logs: data.logs,
      total: data.total,
      page
    };
  } catch (error) {
    console.error('Failed to load logs', error);
    return { logs: [], total: 0, page: 1, error: 'Failed to load system logs' };
  }
};
