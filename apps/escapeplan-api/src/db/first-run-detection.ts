import { db } from './client.js';
import { roles, user } from '@escapeplan/contracts';
import { count } from 'drizzle-orm';

/**
 * Determines if this is the first run of the application by checking for
 * sentinel data that should exist after initial seeding.
 *
 * This function checks for the presence of the four system roles (admin,
 * manager, game_master, customer) that are created during the essential
 * seed process. If fewer than 4 roles exist, this is considered a fresh
 * install that requires seeding.
 *
 * @returns {Promise<boolean>} True if this is a first run (needs seeding), false otherwise
 *
 * @example
 * ```typescript
 * const needsSeeding = await isFirstRun();
 * if (needsSeeding) {
 *   await runEssentialSeeds();
 * }
 * ```
 */
export async function isFirstRun(): Promise<boolean> {
  try {
    // Check if system roles exist - should be 4 roles after seeding:
    // admin, manager, game_master, customer
    const result = await db.select({ count: count() }).from(roles);
    const roleCount = result[0]?.count ?? 0;

    // Return true if fewer than 4 roles (fresh install or incomplete seed)
    // Return false if 4 or more roles (existing installation)
    return roleCount < 4;
  } catch (error) {
    // If the query fails (e.g., table doesn't exist), assume first run
    // This handles the case where migrations haven't been applied yet
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('[First-Run Detection] Error checking roles, assuming first run:', errorMessage);
    return true;
  }
}

/**
 * Determines if the database contains user data beyond the initial admin account.
 *
 * This function checks the number of users in the database. A fresh installation
 * typically has 0-1 users (just the admin), while an installation with actual
 * user data will have 2 or more users.
 *
 * This is useful for determining whether it's safe to run destructive operations
 * like database resets, or to conditionally show onboarding flows.
 *
 * @returns {Promise<boolean>} True if user data exists (>1 user), false otherwise
 *
 * @example
 * ```typescript
 * const hasData = await hasUserData();
 * if (hasData) {
 *   console.warn('Cannot reset database - user data exists');
 * } else {
 *   await resetDatabase();
 * }
 * ```
 */
export async function hasUserData(): Promise<boolean> {
  try {
    // Count users in the database
    const result = await db.select({ count: count() }).from(user);
    const userCount = result[0]?.count ?? 0;

    // Return true if more than 1 user (admin + others)
    // Return false if 0 or 1 user (only admin or none)
    return userCount > 1;
  } catch (error) {
    // If the query fails (e.g., table doesn't exist), assume no user data
    // This is a safe default for determining if destructive operations are allowed
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('[User Data Detection] Error checking users, assuming no user data:', errorMessage);
    return false;
  }
}
