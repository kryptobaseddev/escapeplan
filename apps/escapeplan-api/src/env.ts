/**
 * Dynamic environment configuration - auto-detects runtime context
 * No hardcoded URLs in 2025!
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_API_PORT,
  DEFAULT_BACKUP_RETENTION_DAYS,
  DEFAULT_FILE_SIZE_LIMITS,
  DEFAULT_GITHUB_REPO,
  DEFAULT_AUTO_UPDATE_ENABLED,
  PRODUCTION_DOMAIN,
  FALLBACK_VERSION
} from '@escapeplan/contracts';
import { runtime } from '@escapeplan/contracts/runtime';

export interface AppEnvironment {
  // Runtime detection
  isDev: boolean;
  isProd: boolean;

  // Server configuration
  port: number;
  host: string;

  // URLs (auto-detected)
  baseUrl: string;
  authBaseUrl: string;
  webAppOrigin: string;

  // Release metadata
  version: string;
  githubRepo: string;
  buildDate: string;

  // Feature flags
  enableAutoUpdate: boolean;

  // Asset storage
  maxImageSizeMB: number;
  maxAudioSizeMB: number;
  maxVideoSizeMB: number;
  dataDir: string;
  assetDir: string;

  // Backup
  backupDir: string;
  backupRetentionDays: number;
}

function getVersion(): string {
  try {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || FALLBACK_VERSION;
  } catch {
    return process.env.npm_package_version || FALLBACK_VERSION;
  }
}

function detectBaseUrl(port: number, host: string): string {
  // 1. Explicit env var (highest priority)
  if (process.env.BASE_URL) return process.env.BASE_URL;

  // 2. Production mDNS address
  if (runtime.isProduction) {
    return `https://${PRODUCTION_DOMAIN}`;
  }

  // 3. Check if running behind nginx proxy
  if (process.env.NGINX_PROXY === 'true') {
    return `https://${PRODUCTION_DOMAIN}`;
  }

  // 4. Development fallback
  return `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
}

function detectWebAppOrigin(): string {
  // 1. Explicit env var
  if (process.env.WEB_APP_ORIGIN) return process.env.WEB_APP_ORIGIN;

  // 2. Production
  if (runtime.isProduction) {
    return `https://${PRODUCTION_DOMAIN}`;
  }

  // 3. Development (SvelteKit default port)
  return 'http://localhost:5173';
}

function detectGithubRepo(): string {
  // 1. Env var
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO;

  // 2. Try to read from package.json
  try {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    // Check repository field
    if (pkg.repository?.url) {
      const match = pkg.repository.url.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) return match[1];
    }

    // Check homepage
    if (pkg.homepage) {
      const match = pkg.homepage.match(/github\.com\/([\w-]+\/[\w-]+)/);
      if (match) return match[1];
    }
  } catch {
    // Ignore errors
  }

  // 3. Fallback
  return DEFAULT_GITHUB_REPO;
}

export function loadEnvironment(): AppEnvironment {
  const port = Number(process.env.PORT || DEFAULT_API_PORT);
  const host = process.env.HOST || '0.0.0.0';

  const baseUrl = detectBaseUrl(port, host);
  const webAppOrigin = detectWebAppOrigin();

  return {
    // Runtime
    isDev: runtime.isDevelopment,
    isProd: runtime.isProduction,

    // Server
    port,
    host,

    // URLs
    baseUrl,
    authBaseUrl: process.env.AUTH_BASE_URL || `${baseUrl}/api/auth`,
    webAppOrigin,

    // Release
    version: getVersion(),
    githubRepo: detectGithubRepo(),
    buildDate: process.env.BUILD_DATE || new Date().toISOString(),

    // Features
    enableAutoUpdate: process.env.ENABLE_AUTO_UPDATE !== 'false' ? DEFAULT_AUTO_UPDATE_ENABLED : false,

    // Storage (use runtime detection with env var overrides)
    maxImageSizeMB: Number(process.env.MAX_IMAGE_SIZE_MB || DEFAULT_FILE_SIZE_LIMITS.IMAGE_MB),
    maxAudioSizeMB: Number(process.env.MAX_AUDIO_SIZE_MB || DEFAULT_FILE_SIZE_LIMITS.AUDIO_MB),
    maxVideoSizeMB: Number(process.env.MAX_VIDEO_SIZE_MB || DEFAULT_FILE_SIZE_LIMITS.VIDEO_MB),
    dataDir: process.env.ESCAPEPLAN_DATA_DIR || runtime.dataDir,
    assetDir: process.env.ESCAPEPLAN_ASSET_DIR || runtime.assetsDir,

    // Backup (use runtime detection with env var overrides)
    backupDir: process.env.ESCAPEPLAN_BACKUP_DIR || runtime.backupDir,
    backupRetentionDays: Number(process.env.BACKUP_RETENTION_DAYS || DEFAULT_BACKUP_RETENTION_DAYS)
  };
}

// Singleton instance
export const env = loadEnvironment();

// Log environment on startup (only in dev)
if (env.isDev) {
  console.log('[ENV] Environment loaded:', {
    mode: env.isProd ? 'production' : 'development',
    baseUrl: env.baseUrl,
    authBaseUrl: env.authBaseUrl,
    webAppOrigin: env.webAppOrigin,
    version: env.version,
    githubRepo: env.githubRepo,
    dataDir: env.dataDir,
    assetDir: env.assetDir,
    backupDir: env.backupDir
  });
}
