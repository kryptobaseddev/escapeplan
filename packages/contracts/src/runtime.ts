/**
 * Runtime Environment Detection - NO NODE_ENV Required!
 *
 * This module automatically detects production vs development environments
 * by examining filesystem paths, systemd environment, and build artifacts.
 *
 * This is Node.js ONLY - do not import in browser/SvelteKit contexts!
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface RuntimeEnvironment {
  /** Is this a production environment? */
  isProduction: boolean;
  /** Is this a development environment? */
  isDevelopment: boolean;
  /** Is this running from a Debian package installation? */
  isPackaged: boolean;
  /** Is this running as a systemd service? */
  isSystemd: boolean;
  /** Is this running built/compiled code (vs source)? */
  isBuilt: boolean;

  /** Base directory for all application data */
  baseDir: string;
  /** Directory for SQLite database */
  dataDir: string;
  /** Directory for uploaded assets (images/audio/video) */
  assetsDir: string;
  /** Directory for backup archives */
  backupDir: string;
}

/**
 * Detect runtime environment WITHOUT using NODE_ENV
 *
 * Detection strategy:
 * 1. Check if running from Debian package install location (/opt or /usr/lib)
 * 2. Check if running via systemd (has INVOCATION_ID env var)
 * 3. Check if running built code (dist/ exists, src/ doesn't)
 * 4. Default to development if none of the above
 */
export function detectRuntime(): RuntimeEnvironment {
  const cwd = process.cwd();

  // Check 1: Debian package install location
  const isDebianInstall = cwd.startsWith('/opt/escapeplan') ||
                          cwd.startsWith('/usr/lib/escapeplan');

  // Check 2: Systemd service (systemd always sets INVOCATION_ID)
  const isSystemd = !!process.env.INVOCATION_ID;

  // Check 3: Built code detection
  const hasDistFolder = existsSync(join(cwd, 'dist'));
  const hasSrcFolder = existsSync(join(cwd, 'src'));
  const isBuilt = hasDistFolder && !hasSrcFolder;

  // Production if:
  // - Running from Debian package location
  // - OR running via systemd AND built code
  const isProduction = isDebianInstall || (isSystemd && isBuilt);
  const isDevelopment = !isProduction;

  // Path resolution based on environment
  let baseDir: string;
  let backupDir: string;

  if (isProduction) {
    baseDir = '/var/lib/escapeplan';
    backupDir = '/var/backups/escapeplan';
  } else {
    // Development: relative to current working directory
    baseDir = join(cwd, 'data');
    backupDir = join(cwd, 'data', 'backups');
  }

  return {
    isProduction,
    isDevelopment,
    isPackaged: isDebianInstall,
    isSystemd,
    isBuilt,

    baseDir,
    dataDir: baseDir, // Same as baseDir - database and data files go here
    assetsDir: join(baseDir, 'assets'),
    backupDir
  };
}

/**
 * Singleton runtime environment instance
 * Initialized once on module load
 */
export const runtime = detectRuntime();

// Log environment detection in development
if (runtime.isDevelopment && !process.env.SILENT) {
  console.log('[Runtime] Environment detected:', {
    mode: runtime.isProduction ? 'production' : 'development',
    packaged: runtime.isPackaged,
    systemd: runtime.isSystemd,
    built: runtime.isBuilt,
    baseDir: runtime.baseDir
  });
}
