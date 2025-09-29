import type { PageLoad } from './$types';
import { apiFetch } from '$lib/api/client';
import type { TimerBroadcast } from '$lib/api/types';

export const load: PageLoad = async ({ fetch, params }) => {
  try {
    const data = await apiFetch<TimerBroadcast>(fetch, `/public/timer/${params.slug}`);
    return { timer: data };
  } catch (error) {
    console.error('Failed to load timer', error);
    return { timer: null, timerError: 'Timer unavailable. Confirm the room slug is correct.' };
  }
};
