import { browser } from '$app/environment';
import { dev } from '$app/environment';
import { apiBase } from '$lib/api/client';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

function resolveBaseUrl(): string {
  // In browser, always use page origin in production
  if (browser) {
    const base = apiBase.replace(/\/$/, '');

    // If apiBase is just '/api' (relative path), socket connects to page origin
    if (base === '/api' || base === '') {
      return window.location.origin;
    }

    // Otherwise strip /api from absolute URLs
    if (base.endsWith('/api')) {
      return base.slice(0, -4);
    }
    return base;
  }

  // SSR: In development, connect to API server directly
  if (dev) {
    return 'http://localhost:4000';
  }

  // SSR: Production fallback
  return apiBase.replace(/\/api$/, '') || '/';
}

export function getSocket(): Socket | null {
  if (!browser) return null;
  if (socket) return socket;

  const url = resolveBaseUrl();
  socket = io(url, {
    transports: ['polling', 'websocket'],
    tryAllTransports: true,
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    path: '/socket.io'
  });

  socket.on('disconnect', (reason: string) => {
    console.log(`[Socket.IO] Disconnected: ${reason}`);
    // Don't set socket = null here - Socket.IO will handle automatic reconnection
  });

  socket.on('connect_error', (error: Error) => {
    console.error('[Socket.IO] Connection error:', error.message);
  });

  socket.on('connect', () => {
    console.log(`[Socket.IO] Connected via ${socket?.io.engine.transport.name}`);
  });

  socket.io.engine.on('upgrade', (transport: any) => {
    console.log(`[Socket.IO] Upgraded to ${transport.name}`);
  });

  return socket;
}

export function disconnectSocket() {
  socket?.close();
  socket = null;
}
