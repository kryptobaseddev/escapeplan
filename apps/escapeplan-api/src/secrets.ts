/**
 * Secret generation and management for EscapePlan
 * Auto-generates secrets on first run and stores them securely
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { runtime } from '@escapeplan/contracts/runtime';

const SECRETS_DIR = runtime.isProduction
  ? '/etc/escapeplan/secrets'
  : './data/secrets';

const AUTH_SECRET_PATH = `${SECRETS_DIR}/auth.key`;
const CAMERA_SECRET_PATH = `${SECRETS_DIR}/camera.key`;

export interface Secrets {
  betterAuthSecret: string;
  cameraEncryptionKey: string;
}

/**
 * Generate cryptographically secure random secret
 * @param bytes - Number of bytes (32 = 64 hex chars)
 */
function generateSecret(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Ensure secrets directory exists with secure permissions
 */
function ensureSecretsDir(): void {
  if (!existsSync(SECRETS_DIR)) {
    console.log(`[SECRETS] Creating secrets directory: ${SECRETS_DIR}`);
    mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Load secret from file or generate new one
 * Priority: 1) Environment variable, 2) File, 3) Generate new
 */
function loadOrGenerateSecret(
  path: string,
  bytes: number,
  label: string,
  envVar?: string
): string {
  // 1. Check environment variable first (highest priority)
  if (envVar && process.env[envVar]) {
    console.log(`[SECRETS] Using ${label} secret from environment variable ${envVar}`);
    return process.env[envVar] as string;
  }

  // 2. Try to load from file
  if (existsSync(path)) {
    try {
      const secret = readFileSync(path, 'utf-8').trim();
      if (secret.length >= bytes * 2) { // Hex string should be 2x bytes
        console.log(`[SECRETS] Loaded ${label} secret from ${path}`);
        return secret;
      } else {
        console.warn(`[SECRETS] ${path} exists but is too short, regenerating`);
      }
    } catch (error) {
      console.warn(`[SECRETS] Failed to read ${path}:`, error);
    }
  }

  // 3. Generate new secret
  ensureSecretsDir();
  const newSecret = generateSecret(bytes);

  try {
    writeFileSync(path, newSecret, { mode: 0o600 });
    console.log(`[SECRETS] ✅ Generated new ${label} secret at ${path}`);
  } catch (error) {
    console.warn(`[SECRETS] ⚠️  Failed to save ${label} secret to ${path}:`, error);
    console.warn(`[SECRETS] Using in-memory secret only (will regenerate on restart)`);
  }

  return newSecret;
}

/**
 * Load all secrets required by the application
 * Auto-generates missing secrets on first run
 */
export function loadSecrets(): Secrets {
  console.log('[SECRETS] Initializing secret management...');

  const betterAuthSecret = loadOrGenerateSecret(
    AUTH_SECRET_PATH,
    32,
    'Better Auth',
    'BETTER_AUTH_SECRET'
  );

  const cameraEncryptionKey = loadOrGenerateSecret(
    CAMERA_SECRET_PATH,
    32,
    'Camera Encryption',
    'CAMERA_ENCRYPTION_KEY'
  );

  console.log('[SECRETS] ✅ All secrets loaded');

  return {
    betterAuthSecret,
    cameraEncryptionKey
  };
}

/**
 * Validate secret format and length
 */
export function validateSecret(secret: string, minLength: number = 64): boolean {
  if (!secret || secret.length < minLength) {
    return false;
  }
  // Verify it's valid hex
  return /^[0-9a-f]+$/i.test(secret);
}
