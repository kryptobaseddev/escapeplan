/**
 * Dynamic environment configuration - auto-detects runtime context
 * No hardcoded URLs in 2025!
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AppEnvironment {
  // Runtime detection
  nodeEnv: 'development' | 'production' | 'test';
  isDev: boolean;
  isProd: boolean;
  isTest: boolean;

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
    return pkg.version || '0.1.0';
  } catch {
    return process.env.npm_package_version || '0.1.0';
  }
}

function detectBaseUrl(port: number, host: string): string {
  // 1. Explicit env var (highest priority)
  if (process.env.BASE_URL) return process.env.BASE_URL;

  // 2. Production mDNS address
  if (process.env.NODE_ENV === 'production') {
    return `https://escapeplan.local`;
  }

  // 3. Check if running behind nginx proxy
  if (process.env.NGINX_PROXY === 'true') {
    return `https://escapeplan.local`;
  }

  // 4. Development fallback
  return `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
}

function detectWebAppOrigin(): string {
  // 1. Explicit env var
  if (process.env.WEB_APP_ORIGIN) return process.env.WEB_APP_ORIGIN;

  // 2. Production
  if (process.env.NODE_ENV === 'production') {
    return 'https://escapeplan.local';
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
  return 'escapeplan/escapeplan';
}

export function loadEnvironment(): AppEnvironment {
  const nodeEnv = (process.env.NODE_ENV || 'development') as AppEnvironment['nodeEnv'];
  const port = Number(process.env.PORT || 4000);
  const host = process.env.HOST || '0.0.0.0';

  const baseUrl = detectBaseUrl(port, host);
  const webAppOrigin = detectWebAppOrigin();

  return {
    // Runtime
    nodeEnv,
    isDev: nodeEnv === 'development',
    isProd: nodeEnv === 'production',
    isTest: nodeEnv === 'test',

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
    enableAutoUpdate: process.env.ENABLE_AUTO_UPDATE !== 'false',

    // Storage
    maxImageSizeMB: Number(process.env.MAX_IMAGE_SIZE_MB || 10),
    maxAudioSizeMB: Number(process.env.MAX_AUDIO_SIZE_MB || 25),
    maxVideoSizeMB: Number(process.env.MAX_VIDEO_SIZE_MB || 50),
    dataDir: process.env.ESCAPEPLAN_DATA_DIR || resolve(process.cwd(), 'data'),
    assetDir: process.env.ESCAPEPLAN_ASSET_DIR || resolve(process.cwd(), 'data/assets'),

    // Backup (development-aware)
    backupDir: process.env.ESCAPEPLAN_BACKUP_DIR || (
      nodeEnv === 'production'
        ? '/var/backups/escapeplan'
        : resolve(process.cwd(), 'data/backups')
    ),
    backupRetentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 7)
  };
}

// Singleton instance
export const env = loadEnvironment();

// Log environment on startup (only in dev)
if (env.isDev) {
  console.log('[ENV] Environment loaded:', {
    nodeEnv: env.nodeEnv,
    baseUrl: env.baseUrl,
    authBaseUrl: env.authBaseUrl,
    webAppOrigin: env.webAppOrigin,
    version: env.version,
    githubRepo: env.githubRepo
  });
}
