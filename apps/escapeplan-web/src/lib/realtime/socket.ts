import { browser } from '$app/environment';
import { dev } from '$app/environment';
import { apiBase } from '$lib/api/client';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

function resolveBaseUrl() {
  // In development, use relative path to leverage Vite proxy
  if (dev) {
    return window.location.origin;
  }

  // In production, strip /api from apiBase
  const base = apiBase.replace(/\/$/, '');
  if (base.endsWith('/api')) {
    return base.slice(0, -4);
  }
  return base;
}

export function getSocket() {
  if (!browser) return null;
  if (socket) return socket;
  const url = resolveBaseUrl();
  socket = io(url, {
    transports: ['websocket'],
    withCredentials: true,
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
