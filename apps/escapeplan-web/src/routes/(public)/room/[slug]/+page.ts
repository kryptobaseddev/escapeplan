import type { PageLoad } from './$types';
import { apiFetch } from '$lib/api/client';
import type { TimerBroadcast } from '@escapeplan/contracts';

export const load: PageLoad = async ({ fetch, params }) => {
  try {
    // Note: API endpoint is still /public/timer/ for backward compatibility
    // Frontend route has been renamed to /room/ for clarity
    const data = await apiFetch<TimerBroadcast>(fetch, `/public/timer/${params.slug}`);
    return {
      timer: data,
      roomConfig: data.roomConfig
    };
  } catch (error) {
    console.error('Failed to load room display', error);
    return {
      timer: null,
      roomConfig: null,
      timerError: 'Room display unavailable. Confirm the room slug is correct.'
    };
  }
};
