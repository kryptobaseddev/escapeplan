import type {
  BookingCalendarResponse,
  CommandResponse,
  DashboardResponse,
  GameSessionDetails,
  TimerBroadcast
} from '@escapeplan/contracts';
import { writable } from 'svelte/store';

export const dashboardStore = writable<DashboardResponse | null>(null);
export const sessionsStore = writable<GameSessionDetails[]>([]);
export const bookingsStore = writable<Map<string, BookingCalendarResponse>>(new Map());
export const commandAcks = writable<CommandResponse | null>(null);
export const timerBroadcasts = writable<Map<string, TimerBroadcast>>(new Map());
export type QueuedCommand = {
  sessionId: string;
  command: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

export const offlineCommandQueue = writable<QueuedCommand[]>([]);

export function upsertBookings(calendar: BookingCalendarResponse) {
  bookingsStore.update((current) => {
    const next = new Map(current);
    const key = `${calendar.date}|${calendar.scope}`;
    next.set(key, calendar);
    return next;
  });
}

export function upsertTimerBroadcast(broadcast: TimerBroadcast) {
  if (!broadcast || !broadcast.slug) {
    console.warn('[Realtime] Received invalid timer broadcast:', broadcast);
    return;
  }
  timerBroadcasts.update((current) => {
    const next = new Map(current);
    next.set(broadcast.slug, broadcast);
    return next;
  });
}

export function enqueueOfflineCommand(entry: QueuedCommand) {
  offlineCommandQueue.update((queue) => [...queue, entry]);
}

export function dequeueOfflineCommands(sessionId?: string) {
  if (!sessionId) {
    offlineCommandQueue.set([]);
    return;
  }
  offlineCommandQueue.update((queue) => queue.filter((cmd) => cmd.sessionId !== sessionId));
}
