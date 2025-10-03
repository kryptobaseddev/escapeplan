/**
 * Seed Default System Settings
 *
 * Populates system_settings table with default values.
 * Run this as part of database initialization/migration.
 */

import { db } from './client.js';
import { systemSettings } from '@escapeplan/contracts';
import {
  SETTING_KEYS,
  DEFAULT_FILE_SIZE_LIMITS,
  DEFAULT_BACKUP_RETENTION_DAYS,
  DEFAULT_GITHUB_REPO,
  DEFAULT_AUTO_UPDATE_ENABLED,
  FALLBACK_VERSION
} from '@escapeplan/contracts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Get version from package.json
 */
function getVersion(): string {
  try {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

/**
 * Seed system settings with default values
 */
export async function seedSystemSettings() {
  console.log('[Seed] Populating system_settings table...');

  const defaults = [
    // ========== STORAGE SETTINGS ==========
    {
      key: SETTING_KEYS.STORAGE.MAX_IMAGE_SIZE_MB,
      value: String(DEFAULT_FILE_SIZE_LIMITS.IMAGE_MB),
      type: 'number',
      category: 'storage',
      label: 'Max Image Size (MB)',
      description: 'Maximum file size for image uploads',
      is_editable: true
    },
    {
      key: SETTING_KEYS.STORAGE.MAX_AUDIO_SIZE_MB,
      value: String(DEFAULT_FILE_SIZE_LIMITS.AUDIO_MB),
      type: 'number',
      category: 'storage',
      label: 'Max Audio Size (MB)',
      description: 'Maximum file size for audio uploads',
      is_editable: true
    },
    {
      key: SETTING_KEYS.STORAGE.MAX_VIDEO_SIZE_MB,
      value: String(DEFAULT_FILE_SIZE_LIMITS.VIDEO_MB),
      type: 'number',
      category: 'storage',
      label: 'Max Video Size (MB)',
      description: 'Maximum file size for video uploads',
      is_editable: true
    },

    // ========== BACKUP SETTINGS ==========
    {
      key: SETTING_KEYS.BACKUP.RETENTION_DAYS,
      value: String(DEFAULT_BACKUP_RETENTION_DAYS),
      type: 'number',
      category: 'backup',
      label: 'Backup Retention (Days)',
      description: 'How many days to keep backup files before auto-deletion',
      is_editable: true
    },

    // ========== UPDATE SETTINGS ==========
    {
      key: SETTING_KEYS.UPDATES.GITHUB_REPO,
      value: DEFAULT_GITHUB_REPO,
      type: 'string',
      category: 'updates',
      label: 'GitHub Repository',
      description: 'Repository for checking and downloading updates (format: owner/repo)',
      is_editable: true
    },
    {
      key: SETTING_KEYS.UPDATES.AUTO_UPDATE_ENABLED,
      value: String(DEFAULT_AUTO_UPDATE_ENABLED),
      type: 'boolean',
      category: 'updates',
      label: 'Enable Auto-Updates',
      description: 'Automatically check for and install updates when available',
      is_editable: true
    },

    // ========== SYSTEM INFO (Read-Only) ==========
    {
      key: SETTING_KEYS.SYSTEM.INSTALL_PATH,
      value: process.cwd(),
      type: 'string',
      category: 'system',
      label: 'Install Path',
      description: 'Application installation directory',
      is_editable: false
    },
    {
      key: SETTING_KEYS.SYSTEM.VERSION,
      value: getVersion(),
      type: 'string',
      category: 'system',
      label: 'Version',
      description: 'Current application version',
      is_editable: false
    },
    {
      key: SETTING_KEYS.SYSTEM.BUILD_DATE,
      value: process.env.BUILD_DATE || new Date().toISOString(),
      type: 'string',
      category: 'system',
      label: 'Build Date',
      description: 'When this version was built',
      is_editable: false
    }
  ];

  let seededCount = 0;
  let skippedCount = 0;

  for (const setting of defaults) {
    try {
      await db.insert(systemSettings)
        .values(setting)
        .onConflictDoNothing(); // Don't overwrite existing settings

      seededCount++;
    } catch (error) {
      console.warn(`[Seed] Skipped setting ${setting.key}:`, error);
      skippedCount++;
    }
  }

  console.log(`[Seed] System settings: ${seededCount} created, ${skippedCount} skipped (already exist)`);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSystemSettings()
    .then(() => {
      console.log('[Seed] Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Seed] Failed:', error);
      process.exit(1);
    });
}
