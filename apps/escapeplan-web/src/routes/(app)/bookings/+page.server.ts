import type { PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { BookingCalendarResponse } from '$lib/api/types';

const scopes = ['all', 'storefront', 'mobile'] as const;

type Scope = (typeof scopes)[number];

export const load: PageServerLoad = async (event) => {
  const fetcher = makeServerFetcher(event);
  const date = event.url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const requestedScope = event.url.searchParams.get('scope') as Scope | null;
  const scope: Scope = scopes.includes(requestedScope ?? 'all') ? (requestedScope ?? 'all') : 'all';

  try {
    const calendar = await fetcher<BookingCalendarResponse>(`/bookings?date=${date}&scope=${scope}`);
    return { pageTitle: 'Bookings', calendar, scope, date };
  } catch (error) {
    console.error('Failed to load bookings', error);
    return {
      pageTitle: 'Bookings',
      calendar: null,
      scope,
      date,
      calendarError: 'Unable to load bookings. Ensure Fastify mock API is running.'
    };
  }
};
