#!/usr/bin/env node
/**
 * @fileoverview Validates VERSION file matches package.json version
 * @description This script reads both VERSION file and package.json,
 *              compares their versions, and exits with code 0 if they match
 *              or code 1 if they mismatch. Used in CI/CD to ensure version sync.
 * @author EscapePlan Team
 * @license MIT
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

/**
 * Validates that VERSION file and package.json have matching versions
 * @returns {void}
 * @throws {Error} If file operations fail
 */
function checkVersionSync() {
  try {
    // Read version from root package.json
    const packageJsonPath = join(rootDir, 'package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    if (!packageJson.version) {
      throw new Error('package.json does not contain a version field');
    }

    const packageVersion = packageJson.version;

    // Read version from VERSION file
    const versionFilePath = join(rootDir, 'VERSION');
    const versionFileContent = readFileSync(versionFilePath, 'utf-8');
    const versionFile = versionFileContent.trim();

    if (!versionFile) {
      throw new Error('VERSION file is empty');
    }

    // Compare versions
    if (packageVersion !== versionFile) {
      console.error('❌ VERSION MISMATCH!');
      console.error(`   package.json: ${packageVersion}`);
      console.error(`   VERSION file: ${versionFile}`);
      console.error('');
      console.error('Run: pnpm version (to sync)');
      process.exit(1);
    }

    console.log(`✅ Version synchronized: ${packageVersion}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to check version sync:');
    console.error(error.message);
    process.exit(1);
  }
}

checkVersionSync();
