import { apiFetch } from '$lib/api/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const metrics = await apiFetch<any>(fetch, '/admin/storage/metrics');
    return { metrics };
  } catch (error) {
    console.error('Failed to load storage metrics:', error);
    return { metrics: null, error: 'Failed to load storage metrics' };
  }
};
