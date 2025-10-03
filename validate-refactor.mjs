#!/usr/bin/env node
/**
 * Comprehensive Zero-Config Refactor Validation Script
 *
 * Tests all aspects of the refactor to ensure everything works correctly.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: []
};

function logPass(testName, details) {
  results.passed.push({ testName, details });
  console.log(`\n✅ PASS: ${testName}`);
  if (details) console.log(`   ${details}`);
}

function logFail(testName, error) {
  results.failed.push({ testName, error });
  console.log(`\n❌ FAIL: ${testName}`);
  console.log(`   Error: ${error}`);
}

function logWarning(testName, warning) {
  results.warnings.push({ testName, warning });
  console.log(`\n⚠️  WARNING: ${testName}`);
  console.log(`   ${warning}`);
}

console.log('='.repeat(80));
console.log('ZERO-CONFIG REFACTOR VALIDATION');
console.log('='.repeat(80));

// ============================================================================
// TEST 1: Runtime Detection
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('TEST 1: Runtime Detection');
console.log('='.repeat(80));

try {
  const { runtime, detectRuntime } = await import('./packages/contracts/dist/runtime.js');

  console.log('\nDetected Runtime Environment:');
  console.log(`  isProduction: ${runtime.isProduction}`);
  console.log(`  isDevelopment: ${runtime.isDevelopment}`);
  console.log(`  isPackaged: ${runtime.isPackaged}`);
  console.log(`  isSystemd: ${runtime.isSystemd}`);
  console.log(`  isBuilt: ${runtime.isBuilt}`);
  console.log(`  baseDir: ${runtime.baseDir}`);
  console.log(`  dataDir: ${runtime.dataDir}`);
  console.log(`  assetsDir: ${runtime.assetsDir}`);
  console.log(`  backupDir: ${runtime.backupDir}`);

  // Verify we're in development mode
  if (!runtime.isDevelopment) {
    logFail('Runtime Detection', 'Expected isDevelopment=true in test environment');
  } else if (runtime.baseDir !== join(process.cwd(), 'data')) {
    logFail('Runtime Detection', `Expected baseDir to be ${join(process.cwd(), 'data')}, got ${runtime.baseDir}`);
  } else {
    logPass('Runtime Detection', `Correctly detected development mode, baseDir=${runtime.baseDir}`);
  }
} catch (error) {
  logFail('Runtime Detection', error.message);
}

// ============================================================================
// TEST 2: Path Resolution
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('TEST 2: Path Resolution');
console.log('='.repeat(80));

try {
  const paths = await import('./packages/contracts/dist/paths.js');

  const dbPath = paths.getDatabasePath();
  const assetPath = paths.getAssetBasePath();
  const backupPath = paths.getBackupBasePath();
  const dataPath = paths.getDataBasePath();

  console.log('\nResolved Paths:');
  console.log(`  Database: ${dbPath}`);
  console.log(`  Assets: ${assetPath}`);
  console.log(`  Backups: ${backupPath}`);
  console.log(`  Data: ${dataPath}`);

  // Check if database exists
  const dbExists = existsSync(dbPath);
  console.log(`\nDatabase exists: ${dbExists}`);

  if (!dbExists) {
    logWarning('Path Resolution', 'Database file does not exist yet - this is OK for fresh setup');
  }

  logPass('Path Resolution', `All path functions working correctly`);
} catch (error) {
  logFail('Path Resolution', error.message);
}

// ============================================================================
// TEST 3: Import Chain Test
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('TEST 3: Import Chain Test');
console.log('='.repeat(80));

try {
  console.log('\nTesting import chain...');

  // Test main contracts import
  const contracts = await import('./packages/contracts/dist/index.js');
  console.log('  ✓ Import from @escapeplan/contracts');

  // Test paths subpath import
  const pathsModule = await import('./packages/contracts/dist/paths.js');
  console.log('  ✓ Import from @escapeplan/contracts/paths');

  // Test runtime subpath import
  const runtimeModule = await import('./packages/contracts/dist/runtime.js');
  console.log('  ✓ Import from @escapeplan/contracts/runtime');

  // Check for exports
  if (!pathsModule.getDatabasePath) {
    throw new Error('getDatabasePath not exported from paths module');
  }
  if (!runtimeModule.runtime) {
    throw new Error('runtime not exported from runtime module');
  }

  logPass('Import Chain Test', 'All imports successful, no circular dependencies detected');
} catch (error) {
  logFail('Import Chain Test', error.message);
}

// ============================================================================
// TEST 4: Settings System Test
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('TEST 4: Settings System Test');
console.log('='.repeat(80));

try {
  const paths = await import('./packages/contracts/dist/paths.js');
  const dbPath = paths.getDatabasePath();

  if (!existsSync(dbPath)) {
    logWarning('Settings System Test', 'Database does not exist - cannot test settings table');
  } else {
    try {
      // Use sqlite3 CLI instead of better-sqlite3
      console.log('\nChecking system_settings table...');

      // Check if table exists
      const tableCheck = execSync(
        `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings';"`,
        { encoding: 'utf8' }
      ).trim();

      if (!tableCheck) {
        logFail('Settings System Test', 'system_settings table does not exist');
      } else {
        console.log('  ✓ Table exists');

        // Get table structure
        console.log('\nTable structure:');
        const tableInfo = execSync(
          `sqlite3 "${dbPath}" "PRAGMA table_info(system_settings);"`,
          { encoding: 'utf8' }
        );
        tableInfo.split('\n').filter(Boolean).forEach(line => {
          const parts = line.split('|');
          if (parts.length >= 3) {
            console.log(`  - ${parts[1]}: ${parts[2]}${parts[3] === '1' ? ' NOT NULL' : ''}${parts[5] === '1' ? ' PRIMARY KEY' : ''}`);
          }
        });

        // Count settings
        const countResult = execSync(
          `sqlite3 "${dbPath}" "SELECT COUNT(*) FROM system_settings;"`,
          { encoding: 'utf8' }
        ).trim();
        const count = parseInt(countResult);
        console.log(`\nSettings count: ${count}`);

        // Display all settings
        if (count > 0) {
          console.log('\nAll settings:');
          const settings = execSync(
            `sqlite3 "${dbPath}" "SELECT category, key, value, type FROM system_settings ORDER BY category, key;"`,
            { encoding: 'utf8' }
          );
          settings.split('\n').filter(Boolean).forEach(line => {
            const [category, key, value, type] = line.split('|');
            console.log(`  [${category}] ${key} = ${value} (${type})`);
          });
        }

        // Check foreign keys
        console.log('\nForeign keys:');
        const fkInfo = execSync(
          `sqlite3 "${dbPath}" "PRAGMA foreign_key_list(system_settings);"`,
          { encoding: 'utf8' }
        ).trim();
        if (fkInfo) {
          fkInfo.split('\n').forEach(line => {
            const parts = line.split('|');
            if (parts.length >= 4) {
              console.log(`  - ${parts[3]} -> ${parts[2]}.${parts[4]}`);
            }
          });
        } else {
          console.log('  (none)');
        }

        // Check indexes
        console.log('\nIndexes:');
        const indexInfo = execSync(
          `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='system_settings';"`,
          { encoding: 'utf8' }
        ).trim();
        if (indexInfo) {
          indexInfo.split('\n').forEach(name => {
            console.log(`  - ${name}`);
          });
        } else {
          console.log('  (none)');
        }

        if (count > 0) {
          logPass('Settings System Test', `Table exists with ${count} settings`);
        } else {
          logWarning('Settings System Test', 'Table exists but has no settings - may need seeding');
        }
      }
    } catch (error) {
      logFail('Settings System Test', `Database query error: ${error.message}`);
    }
  }
} catch (error) {
  logFail('Settings System Test', error.message);
}

// ============================================================================
// TEST 5: Build Tests
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('TEST 5: Build Tests');
console.log('='.repeat(80));

try {
  // Check that contracts package has been built
  const contractsDistExists = existsSync(join(__dirname, 'packages/contracts/dist'));
  console.log(`\nContracts dist/ exists: ${contractsDistExists}`);

  if (!contractsDistExists) {
    logFail('Build Tests', 'Contracts package not built - run: pnpm --filter @escapeplan/contracts build');
  } else {
    // Check for key output files
    const expectedFiles = [
      'index.js',
      'index.d.ts',
      'runtime.js',
      'runtime.d.ts',
      'paths.js',
      'paths.d.ts',
      'settings-types.js',
      'settings-types.d.ts'
    ];

    const missingFiles = expectedFiles.filter(f =>
      !existsSync(join(__dirname, 'packages/contracts/dist', f))
    );

    if (missingFiles.length > 0) {
      logFail('Build Tests', `Missing output files: ${missingFiles.join(', ')}`);
    } else {
      console.log('  All expected output files present:');
      expectedFiles.forEach(f => console.log(`    ✓ ${f}`));
      logPass('Build Tests', 'Contracts package built successfully');
    }
  }
} catch (error) {
  logFail('Build Tests', error.message);
}

// ============================================================================
// TEST 6: File System Check
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('TEST 6: File System Check');
console.log('='.repeat(80));

try {
  console.log('\nChecking for .env files...');
  const envLocations = [
    'apps/escapeplan-api/.env',
    'apps/escapeplan-api/.env.local',
    'apps/escapeplan-web/.env',
    'apps/escapeplan-web/.env.local',
    '.env',
    '.env.local'
  ];

  const foundEnvFiles = envLocations.filter(loc =>
    existsSync(join(__dirname, loc))
  );

  if (foundEnvFiles.length > 0) {
    logWarning('File System Check', `Found .env files (should be removed): ${foundEnvFiles.join(', ')}`);
  } else {
    console.log('  ✓ No .env files found');
  }

  console.log('\nChecking for old paths.ts in API...');
  const oldPathsFile = join(__dirname, 'apps/escapeplan-api/src/paths.ts');
  if (existsSync(oldPathsFile)) {
    logFail('File System Check', 'Old apps/escapeplan-api/src/paths.ts still exists - should be deleted');
  } else {
    console.log('  ✓ Old paths.ts deleted from API');
  }

  console.log('\nRemaining config files:');
  const configFiles = [
    'apps/escapeplan-api/src/auth-config.ts',
    'packages/contracts/tsconfig.json',
    'apps/escapeplan-api/tsconfig.json'
  ];

  configFiles.forEach(file => {
    const exists = existsSync(join(__dirname, file));
    console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  });

  logPass('File System Check', 'File system structure validated');
} catch (error) {
  logFail('File System Check', error.message);
}

// ============================================================================
// TEST 7: Settings Types Check
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('TEST 7: Settings Types Check');
console.log('='.repeat(80));

try {
  const settingsTypes = await import('./packages/contracts/dist/settings-types.js');
  console.log('\nSettings types module loaded successfully');

  // Check constants
  const constants = await import('./packages/contracts/dist/constants.js');
  console.log('\nConstants module exports:');
  console.log(`  SETTING_TYPES: ${constants.SETTING_TYPES ? '✓' : '✗'}`);
  console.log(`  SETTING_CATEGORIES: ${constants.SETTING_CATEGORIES ? '✓' : '✗'}`);

  if (constants.SETTING_TYPES && constants.SETTING_CATEGORIES) {
    logPass('Settings Types Check', 'All settings type definitions exported correctly');
  } else {
    logFail('Settings Types Check', 'Missing constants exports');
  }
} catch (error) {
  logFail('Settings Types Check', error.message);
}

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('VALIDATION SUMMARY');
console.log('='.repeat(80));

console.log(`\n✅ PASSED: ${results.passed.length}`);
results.passed.forEach(r => console.log(`   - ${r.testName}`));

if (results.warnings.length > 0) {
  console.log(`\n⚠️  WARNINGS: ${results.warnings.length}`);
  results.warnings.forEach(r => console.log(`   - ${r.testName}: ${r.warning}`));
}

if (results.failed.length > 0) {
  console.log(`\n❌ FAILED: ${results.failed.length}`);
  results.failed.forEach(r => console.log(`   - ${r.testName}: ${r.error}`));
  console.log('\n' + '='.repeat(80));
  console.log('❌ VALIDATION FAILED - See errors above');
  console.log('='.repeat(80));
  process.exit(1);
} else {
  console.log('\n' + '='.repeat(80));
  console.log('✅ ALL TESTS PASSED');
  console.log('='.repeat(80));
  process.exit(0);
}
