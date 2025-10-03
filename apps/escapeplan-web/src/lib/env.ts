/**
 * Dynamic environment configuration for SvelteKit
 * Auto-detects API base URL from runtime context
 */

import { dev, browser } from '$app/environment';
import {
  DEFAULT_API_PORT,
  PRODUCTION_DOMAIN,
  API_BASE_PATH
} from '@escapeplan/contracts';

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
    const { protocol, hostname } = window.location;

    // Production: Check if hostname matches production domain
    const isProduction = hostname === PRODUCTION_DOMAIN;

    if (isProduction) {
      return `${protocol}//${hostname}${API_BASE_PATH}`;
    }

    // Development: API on configured port
    return `http://localhost:${DEFAULT_API_PORT}${API_BASE_PATH}`;
  }

  // 3. SSR fallback
  if (dev) {
    return `http://localhost:${DEFAULT_API_PORT}${API_BASE_PATH}`;
  }

  // Production SSR
  return `https://${PRODUCTION_DOMAIN}${API_BASE_PATH}`;
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
