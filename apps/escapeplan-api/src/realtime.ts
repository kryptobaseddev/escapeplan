import type {
  BookingCalendarResponse,
  CommandResponse,
  DashboardResponse,
  GameSessionDetails,
  TimerBroadcast
} from '@escapeplan/contracts';
import type { Server } from 'socket.io';

let io: Server | null = null;

export function attachRealtime(server: Server) {
  io = server;
}

export function emitSessionUpdate(session: GameSessionDetails) {
  io?.emit('session:update', session);
}

export function emitCommandAck(response: CommandResponse) {
  io?.emit('session:command', response);
}

export function emitDashboardUpdate(snapshot: DashboardResponse) {
  io?.emit('dashboard:update', snapshot);
}

export function emitTimerUpdate(broadcast: TimerBroadcast) {
  io?.emit('timer:update', broadcast);
}

export function emitBookingsUpdate(payload: BookingCalendarResponse) {
  io?.emit('bookings:update', payload);
}

export function emitAuthRotation() {
  io?.emit('admin:credentials:rotated');
}
