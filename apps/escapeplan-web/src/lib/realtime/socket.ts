import { browser } from '$app/environment';
import { dev } from '$app/environment';
import { apiBase } from '$lib/api/client';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

function resolveBaseUrl(): string {
  // In development, Socket.IO needs to connect directly to the API server
  // because WebSocket connections bypass the Vite HTTP proxy
  if (dev) {
    return 'http://localhost:4000';
  }

  // In production, strip /api from apiBase to get the base URL
  const base = apiBase.replace(/\/$/, '');
  if (base.endsWith('/api')) {
    return base.slice(0, -4);
  }
  return base;
}

export function getSocket(): Socket | null {
  if (!browser) return null;
  if (socket) return socket;

  const url = resolveBaseUrl();
  socket = io(url, {
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: true
  });

  socket.on('disconnect', (reason: string) => {
    console.log(`[Socket.IO] Disconnected: ${reason}`);
    socket = null;
  });

  socket.on('connect_error', (error: Error) => {
    console.error('[Socket.IO] Connection error:', error.message);
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected to', url);
  });

  return socket;
}

export function disconnectSocket() {
  socket?.close();
  socket = null;
}
