import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@escapeplan/contracts';
import { sql } from 'drizzle-orm';
import { isFirstRun, hasUserData } from '../src/db/first-run-detection.js';
import { nanoid } from 'nanoid';

// Mock the db client module to use in-memory database for tests
// This avoids interfering with the actual development database
let testDb: ReturnType<typeof drizzle>;
let testSqlite: Database.Database;

beforeEach(async () => {
  // Create in-memory SQLite database for isolated testing
  testSqlite = new Database(':memory:');
  testSqlite.pragma('journal_mode = WAL');
  testSqlite.pragma('foreign_keys = ON');

  testDb = drizzle({ client: testSqlite, schema });

  // Create tables by executing the schema creation SQL
  // This simulates migrations being applied
  createTables();

  // Mock the db client module to use our test database
  await import('../src/db/client.js').then((module) => {
    // Replace the db export with our test database
    Object.defineProperty(module, 'db', {
      value: testDb,
      writable: true,
      configurable: true
    });
  });
});

afterEach(() => {
  // Clean up: close the test database connection
  testSqlite.close();
});

/**
 * Helper function to create necessary tables in the test database
 * This simulates the state after migrations have been applied
 */
function createTables(): void {
  // Create roles table
  testSqlite.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      user_type_scope TEXT NOT NULL DEFAULT 'operator',
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create user table
  testSqlite.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      emailVerified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      username TEXT NOT NULL UNIQUE,
      user_type TEXT NOT NULL DEFAULT 'operator',
      role_id TEXT NOT NULL,
      bio TEXT,
      avatar_config TEXT,
      must_reset_password INTEGER NOT NULL DEFAULT 0,
      loyalty_points INTEGER DEFAULT 0,
      preferred_difficulty TEXT,
      marketing_opted_in INTEGER DEFAULT 0,
      password_hash TEXT,
      last_login_at TEXT,
      banned INTEGER NOT NULL DEFAULT 0,
      ban_reason TEXT,
      ban_expires TEXT,
      archived_at TEXT,
      archived_by TEXT,
      archived_reason TEXT
    );
  `);
}

/**
 * Helper function to seed the four system roles
 */
function seedSystemRoles(): void {
  const roles = [
    { id: nanoid(), name: 'admin', description: 'Administrator', user_type_scope: 'operator' },
    { id: nanoid(), name: 'manager', description: 'Manager', user_type_scope: 'operator' },
    { id: nanoid(), name: 'game_master', description: 'Game Master', user_type_scope: 'operator' },
    { id: nanoid(), name: 'customer', description: 'Customer', user_type_scope: 'customer' }
  ];

  for (const role of roles) {
    testSqlite
      .prepare(`
        INSERT INTO roles (id, name, description, user_type_scope, is_system)
        VALUES (?, ?, ?, ?, 1)
      `)
      .run(role.id, role.name, role.description, role.user_type_scope);
  }
}

/**
 * Helper function to create test users
 */
function createTestUser(username: string, email: string, roleId: string): void {
  testSqlite
    .prepare(`
      INSERT INTO user (id, name, email, username, user_type, role_id, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(nanoid(), username, email, username, 'operator', roleId, 'hashed_password');
}

describe('First-Run Detection - isFirstRun()', () => {
  test('returns true when no roles exist (fresh database)', async () => {
    // Test database has tables but no data
    const result = await isFirstRun();
    expect(result).toBe(true);
  });

  test('returns true when fewer than 4 roles exist (incomplete seed)', async () => {
    // Seed only 2 roles
    const roles = [
      { id: nanoid(), name: 'admin', description: 'Administrator', user_type_scope: 'operator' },
      { id: nanoid(), name: 'manager', description: 'Manager', user_type_scope: 'operator' }
    ];

    for (const role of roles) {
      testSqlite
        .prepare(`
          INSERT INTO roles (id, name, description, user_type_scope, is_system)
          VALUES (?, ?, ?, ?, 1)
        `)
        .run(role.id, role.name, role.description, role.user_type_scope);
    }

    const result = await isFirstRun();
    expect(result).toBe(true);
  });

  test('returns false when 4 system roles exist (seeded database)', async () => {
    // Seed all 4 system roles
    seedSystemRoles();

    const result = await isFirstRun();
    expect(result).toBe(false);
  });

  test('returns false when more than 4 roles exist (existing installation)', async () => {
    // Seed system roles
    seedSystemRoles();

    // Add a custom role
    testSqlite
      .prepare(`
        INSERT INTO roles (id, name, description, user_type_scope, is_system)
        VALUES (?, ?, ?, ?, 0)
      `)
      .run(nanoid(), 'custom_role', 'Custom Role', 'operator');

    const result = await isFirstRun();
    expect(result).toBe(false);
  });

  test('returns true when roles table does not exist (migrations not applied)', async () => {
    // Drop the roles table to simulate pre-migration state
    testSqlite.exec('DROP TABLE IF EXISTS roles');

    const result = await isFirstRun();
    expect(result).toBe(true);
  });

  test('handles database errors gracefully and returns true as safe default', async () => {
    // Close the database to force an error on next query
    testSqlite.close();

    const result = await isFirstRun();
    expect(result).toBe(true);
  });
});

describe('First-Run Detection - hasUserData()', () => {
  test('returns false when no users exist (fresh database)', async () => {
    // Seed roles so we can test user logic
    seedSystemRoles();

    const result = await hasUserData();
    expect(result).toBe(false);
  });

  test('returns false when only 1 user exists (only admin)', async () => {
    // Seed roles
    seedSystemRoles();

    // Get admin role ID
    const adminRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('admin') as { id: string };

    // Create only the admin user
    createTestUser('admin', 'admin@escapeplan.local', adminRole.id);

    const result = await hasUserData();
    expect(result).toBe(false);
  });

  test('returns true when 2 users exist (admin + 1 other)', async () => {
    // Seed roles
    seedSystemRoles();

    // Get role IDs
    const adminRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('admin') as { id: string };
    const managerRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('manager') as { id: string };

    // Create admin and one more user
    createTestUser('admin', 'admin@escapeplan.local', adminRole.id);
    createTestUser('manager1', 'manager@escapeplan.local', managerRole.id);

    const result = await hasUserData();
    expect(result).toBe(true);
  });

  test('returns true when multiple users exist', async () => {
    // Seed roles
    seedSystemRoles();

    // Get role IDs
    const adminRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('admin') as { id: string };
    const managerRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('manager') as { id: string };
    const gmRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('game_master') as { id: string };

    // Create multiple users
    createTestUser('admin', 'admin@escapeplan.local', adminRole.id);
    createTestUser('manager1', 'manager@escapeplan.local', managerRole.id);
    createTestUser('gm1', 'gm@escapeplan.local', gmRole.id);

    const result = await hasUserData();
    expect(result).toBe(true);
  });

  test('returns false when user table does not exist (migrations not applied)', async () => {
    // Drop the user table to simulate pre-migration state
    testSqlite.exec('DROP TABLE IF EXISTS user');

    const result = await hasUserData();
    expect(result).toBe(false);
  });

  test('handles database errors gracefully and returns false as safe default', async () => {
    // Close the database to force an error on next query
    testSqlite.close();

    const result = await hasUserData();
    expect(result).toBe(false);
  });
});

describe('First-Run Detection - Integration Scenarios', () => {
  test('fresh database: isFirstRun=true, hasUserData=false', async () => {
    // Empty database with tables created
    const firstRun = await isFirstRun();
    const userData = await hasUserData();

    expect(firstRun).toBe(true);
    expect(userData).toBe(false);
  });

  test('seeded database with only admin: isFirstRun=false, hasUserData=false', async () => {
    // Seed system roles
    seedSystemRoles();

    // Add only admin user
    const adminRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('admin') as { id: string };
    createTestUser('admin', 'admin@escapeplan.local', adminRole.id);

    const firstRun = await isFirstRun();
    const userData = await hasUserData();

    expect(firstRun).toBe(false);
    expect(userData).toBe(false);
  });

  test('production database with users: isFirstRun=false, hasUserData=true', async () => {
    // Seed system roles
    seedSystemRoles();

    // Add multiple users
    const adminRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('admin') as { id: string };
    const managerRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('manager') as { id: string };

    createTestUser('admin', 'admin@escapeplan.local', adminRole.id);
    createTestUser('manager1', 'manager@escapeplan.local', managerRole.id);
    createTestUser('manager2', 'manager2@escapeplan.local', managerRole.id);

    const firstRun = await isFirstRun();
    const userData = await hasUserData();

    expect(firstRun).toBe(false);
    expect(userData).toBe(true);
  });

  test('corrupted database (admin deleted): isFirstRun=false, hasUserData=true', async () => {
    // Seed system roles
    seedSystemRoles();

    // Add users but NOT admin (simulating admin deletion)
    const managerRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('manager') as { id: string };
    const gmRole = testSqlite.prepare('SELECT id FROM roles WHERE name = ?').get('game_master') as { id: string };

    createTestUser('manager1', 'manager@escapeplan.local', managerRole.id);
    createTestUser('gm1', 'gm@escapeplan.local', gmRole.id);

    const firstRun = await isFirstRun();
    const userData = await hasUserData();

    // Still not first run (roles exist), but has user data
    expect(firstRun).toBe(false);
    expect(userData).toBe(true);
  });
});
