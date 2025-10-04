import type {
  BookingCalendarResponse,
  CommandResponse,
  DashboardResponse,
  GameSessionDetails,
  TimerBroadcast,
  RoomDisplayMediaEvent,
  RoomDisplayStatusEvent
} from '@escapeplan/contracts';
import type { Server } from 'socket.io';

let io: Server | null = null;

export function attachRealtime(server: Server) {
  io = server;
}

/**
 * Emit session update to authenticated operator consoles only
 * @param session - The game session details to broadcast
 */
export function emitSessionUpdate(session: GameSessionDetails) {
  // Only send to authenticated sockets (operator consoles)
  io?.sockets.sockets.forEach((socket) => {
    if (socket.data.authenticated === true) {
      socket.emit('session:update', session);
    }
  });
}

export function emitCommandAck(response: CommandResponse) {
  // Only send to authenticated sockets (operator consoles)
  io?.sockets.sockets.forEach((socket) => {
    if (socket.data.authenticated === true) {
      socket.emit('session:command', response);
    }
  });
}

export function emitDashboardUpdate(snapshot: DashboardResponse) {
  // Only send to authenticated sockets (operator consoles)
  io?.sockets.sockets.forEach((socket) => {
    if (socket.data.authenticated === true) {
      socket.emit('dashboard:update', snapshot);
    }
  });
}

export function emitTimerUpdate(broadcast: TimerBroadcast) {
  // Send to ALL connected sockets (including public room displays)
  io?.emit('timer:update', broadcast);
}

export function emitBookingsUpdate(payload: BookingCalendarResponse) {
  // Only send to authenticated sockets (operator consoles)
  io?.sockets.sockets.forEach((socket) => {
    if (socket.data.authenticated === true) {
      socket.emit('bookings:update', payload);
    }
  });
}

/**
 * Emit room display media command to all connected sockets (authenticated and unauthenticated)
 * Public room displays need this event to show hints, videos, images, and audio
 * @param event - The media event containing media type, source URL, and display settings
 */
export function emitRoomDisplayMedia(event: RoomDisplayMediaEvent) {
  // Send to ALL connected sockets (including public room displays)
  io?.emit('room-display:media', event);
}

/**
 * Emit room display playback status to all connected sockets
 * Operator consoles use this to track whether room displays successfully played media
 * @param status - The playback status event (playing, finished, dismissed, error)
 */
export function emitRoomDisplayStatus(status: RoomDisplayStatusEvent) {
  // Send to ALL connected sockets (operator consoles need to track room display state)
  io?.emit('room-display:status', status);
}
