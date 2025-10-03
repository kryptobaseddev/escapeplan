#!/usr/bin/env node
/**
 * Test Settings Manager functionality
 *
 * This test runs from the API directory context to simulate real usage
 */

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Change to API directory to get correct runtime paths
process.chdir('/mnt/projects/escape-plan/escapeplan-app/apps/escapeplan-api');

console.log('='.repeat(80));
console.log('SETTINGS MANAGER TEST');
console.log('='.repeat(80));
console.log('\nWorking directory:', process.cwd());

try {
  console.log('\n1. Testing runtime detection from API context...');
  const { runtime } = await import('@escapeplan/contracts/runtime');
  console.log('   ✓ Runtime module loaded');
  console.log('   - baseDir:', runtime.baseDir);
  console.log('   - isDevelopment:', runtime.isDevelopment);

  console.log('\n2. Testing database path resolution...');
  const { getDatabasePath } = await import('@escapeplan/contracts/paths');
  const dbPath = getDatabasePath();
  console.log('   ✓ Database path:', dbPath);

  console.log('\n3. Importing settings manager...');
  const { settings, initializeSettings } = await import('./apps/escapeplan-api/src/settings.js');
  console.log('   ✓ Settings manager imported');

  console.log('\n4. Initializing settings manager...');
  await initializeSettings();
  console.log('   ✓ Settings initialized');

  console.log('\n5. Testing settings getters...');
  const maxImageSize = settings.getMaxImageSizeMB();
  console.log('   - Max image size:', maxImageSize, 'MB');

  const maxAudioSize = settings.getMaxAudioSizeMB();
  console.log('   - Max audio size:', maxAudioSize, 'MB');

  const maxVideoSize = settings.getMaxVideoSizeMB();
  console.log('   - Max video size:', maxVideoSize, 'MB');

  const backupRetention = settings.getBackupRetentionDays();
  console.log('   - Backup retention:', backupRetention, 'days');

  const githubRepo = settings.getGithubRepo();
  console.log('   - GitHub repo:', githubRepo);

  const autoUpdate = settings.isAutoUpdateEnabled();
  console.log('   - Auto-update enabled:', autoUpdate);

  console.log('\n6. Testing direct setting access...');
  const installPath = settings.get('system.install_path');
  console.log('   - Install path:', installPath);

  const version = settings.get('system.version');
  console.log('   - Version:', version);

  const buildDate = settings.get('system.build_date');
  console.log('   - Build date:', buildDate);

  console.log('\n7. Getting all settings by category...');
  const allSettings = await settings.getAll();
  console.log('   ✓ Categories found:', Object.keys(allSettings).join(', '));

  for (const [category, categorySettings] of Object.entries(allSettings)) {
    if (categorySettings.length > 0) {
      console.log(`   - ${category}: ${categorySettings.length} settings`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ ALL SETTINGS MANAGER TESTS PASSED');
  console.log('='.repeat(80));

  process.exit(0);
} catch (error) {
  console.error('\n' + '='.repeat(80));
  console.error('❌ SETTINGS MANAGER TEST FAILED');
  console.error('='.repeat(80));
  console.error('\nError:', error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
}
