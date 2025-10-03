import type {
  BookingCalendarResponse,
  DashboardResponse,
  GameSessionDetails
} from '@escapeplan/contracts';
import { browser } from '$app/environment';
import { getSocket } from './socket';
import {
  bookingsStore,
  commandAcks,
  dashboardStore,
  dequeueOfflineCommands,
  offlineCommandQueue,
  sessionsStore,
  upsertBookings,
  upsertTimerBroadcast
} from './stores';
import type { CommandResponse, TimerBroadcast } from '@escapeplan/contracts';

let registered = false;

interface InitialRealtimeState {
  dashboard?: DashboardResponse | null;
  sessions?: GameSessionDetails[];
  bookings?: Array<BookingCalendarResponse>;
}

export function initializeRealtime(initial: InitialRealtimeState = {}) {
  // Only initialize stores if they're explicitly provided
  // This prevents overwriting real-time updates when navigating between pages
  if (initial.dashboard !== undefined) {
    dashboardStore.set(initial.dashboard);
  }
  if (initial.sessions !== undefined) {
    sessionsStore.set(initial.sessions);
  }
  if (initial.bookings) {
    for (const calendar of initial.bookings) {
      upsertBookings(calendar);
    }
  }

  if (!browser || registered) return;

  const socket = getSocket();
  if (!socket) return;

  socket.on('connect_error', (err) => {
    console.warn('Realtime connection failed', err.message);
  });

  socket.on('dashboard:update', (payload: DashboardResponse) => {
    dashboardStore.set(payload);
  });

  socket.on('session:update:init', (items: GameSessionDetails[]) => {
    sessionsStore.set(items);
  });

  socket.on('session:update', (session: GameSessionDetails) => {
    sessionsStore.update((current) => {
      const idx = current.findIndex((s) => s.id === session.id);
      if (idx === -1) {
        return [...current, session];
      }
      const next = [...current];
      next[idx] = session;
      return next;
    });
  });

  socket.on('session:command', (ack: CommandResponse) => {
    commandAcks.set(ack);
    dequeueOfflineCommands(ack.session.id);
  });

  socket.on('timer:update', (broadcast: TimerBroadcast) => {
    upsertTimerBroadcast(broadcast);
  });

  socket.on('bookings:update', (calendar: BookingCalendarResponse) => {
    upsertBookings(calendar);
  });

  registered = true;
}

export { enqueueOfflineCommand } from './stores';
