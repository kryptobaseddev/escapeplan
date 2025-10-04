#!/usr/bin/env node
/**
 * @fileoverview Synchronizes VERSION file with root package.json version
 * @description This script reads the version from package.json (updated by changesets)
 *              and writes it to the VERSION file at the repository root.
 *              Run after: changeset version
 * @author EscapePlan Team
 * @license MIT
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

/**
 * Synchronizes the VERSION file with the version from package.json
 * @returns {void}
 * @throws {Error} If file operations fail
 */
function syncVersion() {
  try {
    // Read version from root package.json (updated by changesets)
    const packageJsonPath = join(rootDir, 'package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    if (!packageJson.version) {
      throw new Error('package.json does not contain a version field');
    }

    const version = packageJson.version;

    // Write to VERSION file (with trailing newline for POSIX compliance)
    const versionFilePath = join(rootDir, 'VERSION');
    writeFileSync(versionFilePath, version + '\n', 'utf-8');

    console.log(`✅ Synced VERSION file to ${version}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to sync VERSION file:');
    console.error(error.message);
    process.exit(1);
  }
}

syncVersion();
