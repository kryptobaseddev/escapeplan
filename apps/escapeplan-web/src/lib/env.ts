/**
 * Dynamic environment configuration for SvelteKit
 * Auto-detects API base URL from runtime context
 */

import { dev } from '$app/environment';
import { browser } from '$app/environment';

export interface ClientEnvironment {
  apiBaseUrl: string;
  isDev: boolean;
  isProd: boolean;
}

function detectApiBaseUrl(): string {
  // 1. Build-time env var (highest priority)
  const buildTimeUrl = import.meta.env.PUBLIC_API_BASE_URL;
  if (buildTimeUrl) return buildTimeUrl;

  // 2. Browser runtime detection
  if (browser) {
    const { protocol, hostname, port } = window.location;

    // Production: Same origin as web app
    if (!dev) {
      return `${protocol}//${hostname}/api`;
    }

    // Development: API on port 4000
    return 'http://localhost:4000/api';
  }

  // 3. SSR fallback
  if (dev) {
    return 'http://localhost:4000/api';
  }

  // Production SSR
  return 'https://escapeplan.local/api';
}

export const env: ClientEnvironment = {
  apiBaseUrl: detectApiBaseUrl(),
  isDev: dev,
  isProd: !dev
};

// Log in development
if (dev && browser) {
  console.log('[ENV] Client environment:', {
    apiBaseUrl: env.apiBaseUrl,
    isDev: env.isDev,
    currentUrl: window.location.href
  });
}
