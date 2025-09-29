import { browser } from '$app/environment';
import { apiBase } from '$lib/api/client';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

function resolveBaseUrl() {
  const base = apiBase.replace(/\/$/, '');
  if (base.endsWith('/api')) {
    return base.slice(0, -4);
  }
  return base;
}

export function getSocket(token?: string | null) {
  if (!browser) return null;
  if (socket) return socket;
  const url = resolveBaseUrl();
  socket = io(url, {
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    autoConnect: true
  });
  socket.on('disconnect', () => {
    socket = null;
  });
  return socket;
}

export function disconnectSocket() {
  socket?.close();
  socket = null;
}
