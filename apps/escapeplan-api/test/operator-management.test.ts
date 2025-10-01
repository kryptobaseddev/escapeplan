import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/index.js';
import { sqlite } from '../src/db/client.js';
import type { OperatorSummary } from '@escapeplan/contracts';

let server: FastifyInstance;
let adminSessionCookie: string;
let testOperatorId: string | null = null;

beforeAll(async () => {
  await import('../src/db/seed.ts');
  server = await buildServer();

  // Authenticate as admin for test operations
  const authResponse = await server.inject({
    method: 'POST',
    url: '/api/auth/sign-in/username',
    payload: { username: 'admin', password: 'escapeplan' }
  });

  const cookies = authResponse.headers['set-cookie'];
  const rawCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  adminSessionCookie = rawCookie!.split(';')[0];
});

afterAll(async () => {
  // Clean up test operator if created
  if (testOperatorId) {
    sqlite.prepare(`DELETE FROM operator_auth_sessions WHERE user_id = ?`).run(testOperatorId);
    sqlite.prepare(`DELETE FROM operator_accounts WHERE user_id = ?`).run(testOperatorId);
    sqlite.prepare(`DELETE FROM operators WHERE id = ?`).run(testOperatorId);
  }
  await server.close();
});

describe('Operator Management with Better-Auth', () => {
  // Use randomized usernames/emails to avoid unique constraint violations across test runs
  // Use only alphanumeric characters for username to comply with Better-Auth validation
  const randomSuffix = Date.now().toString(36);
  const testUsername = `testop${randomSuffix}`;
  const testEmail = `testop${randomSuffix}@escapeplan.local`;
  const testPassword = 'TestPassword123!';

  test('creates operator with avatar config persisted via Better-Auth', async () => {
    const avatarConfig = {
      seed: 'testuser',
      eyes: ['happy'],
      mouth: ['smile01']
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminSessionCookie },
      payload: {
        username: testUsername,
        name: 'Test Operator',
        email: testEmail,
        password: testPassword,
        role: 'manager',
        bio: 'Test bio for operator',
        avatarConfig,
        mustResetPassword: false
      }
    });

    expect(response.statusCode).toBe(200);
    const operator = response.json() as OperatorSummary;

    expect(operator.username).toBe(testUsername);
    expect(operator.role).toBe('manager');
    expect(operator.avatarConfig).toBeDefined();
    expect(operator.avatarConfig).toEqual(avatarConfig);
    expect(operator.bio).toBe('Test bio for operator');

    testOperatorId = operator.id;

    // Verify avatar_config is persisted correctly in database via Better-Auth
    const dbRow = sqlite
      .prepare('SELECT avatar_config FROM operators WHERE id = ?')
      .get(testOperatorId) as { avatar_config: string | null };

    expect(dbRow.avatar_config).toBeDefined();
    expect(JSON.parse(dbRow.avatar_config!)).toEqual(avatarConfig);
  });

  test('updates operator avatar config via Better-Auth', async () => {
    if (!testOperatorId) {
      throw new Error('Test operator not created');
    }

    const newAvatarConfig = {
      seed: 'testuser-updated',
      eyes: ['wink'],
      mouth: ['smile02']
    };

    const response = await server.inject({
      method: 'PATCH',
      url: `/api/admin/users/${testOperatorId}`,
      headers: { cookie: adminSessionCookie },
      payload: {
        avatarConfig: newAvatarConfig
      }
    });

    expect(response.statusCode).toBe(200);
    const operator = response.json() as OperatorSummary;

    expect(operator.avatarConfig).toEqual(newAvatarConfig);

    // Verify database persistence via Better-Auth adapter
    const dbRow = sqlite
      .prepare('SELECT avatar_config FROM operators WHERE id = ?')
      .get(testOperatorId) as { avatar_config: string | null };

    expect(dbRow.avatar_config).toBeDefined();
    expect(JSON.parse(dbRow.avatar_config!)).toEqual(newAvatarConfig);
  });

  test('archives operator blocking login, then unarchives restoring access', async () => {
    if (!testOperatorId) {
      throw new Error('Test operator not created');
    }

    // Archive the test operator
    const archiveResponse = await server.inject({
      method: 'PATCH',
      url: `/api/admin/users/${testOperatorId}/archive`,
      headers: { cookie: adminSessionCookie },
      payload: {
        reason: 'Test archival'
      }
    });

    expect(archiveResponse.statusCode).toBe(200);
    const archivedOperator = archiveResponse.json() as OperatorSummary;
    expect(archivedOperator.archivedAt).toBeDefined();
    expect(archivedOperator.archivedReason).toBe('Test archival');

    // Verify archivedAt is persisted in database
    const dbRow = sqlite
      .prepare('SELECT archived_at FROM operators WHERE id = ?')
      .get(testOperatorId) as { archived_at: string | null };

    expect(dbRow.archived_at).toBeDefined();
    expect(dbRow.archived_at).not.toBeNull();

    // Verify archived user cannot authenticate (blocked at sign-in endpoint via index.ts check)
    const blockedLoginResponse = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/username',
      payload: { username: testUsername, password: testPassword }
    });

    // Should return 403 with ACCOUNT_ARCHIVED error code
    expect(blockedLoginResponse.statusCode).toBe(403);
    const blockedError = blockedLoginResponse.json() as { error?: { code?: string } };
    expect(blockedError.error?.code).toBe('ACCOUNT_ARCHIVED');

    // Unarchive the operator
    const unarchiveResponse = await server.inject({
      method: 'PATCH',
      url: `/api/admin/users/${testOperatorId}/unarchive`,
      headers: { cookie: adminSessionCookie }
    });

    expect(unarchiveResponse.statusCode).toBe(200);
    const unarchivedOperator = unarchiveResponse.json() as OperatorSummary;
    expect(unarchivedOperator.archivedAt).toBeUndefined();

    // Verify archived_at is cleared in database
    const unarchivedDbRow = sqlite
      .prepare('SELECT archived_at FROM operators WHERE id = ?')
      .get(testOperatorId) as { archived_at: string | null };

    expect(unarchivedDbRow.archived_at).toBeNull();

    // Verify unarchived user CAN authenticate successfully
    const successLoginResponse = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/username',
      payload: { username: testUsername, password: testPassword }
    });

    expect(successLoginResponse.statusCode).toBe(200);
    const cookies = successLoginResponse.headers['set-cookie'];
    expect(cookies).toBeDefined();
  });

  test('verifies role permissions are stored via Better-Auth', async () => {
    // Check admin has correct permissions
    const adminRow = sqlite
      .prepare('SELECT role, permissions FROM operators WHERE username = ?')
      .get('admin') as { role: string; permissions: string };

    expect(adminRow.role).toBe('admin');

    const permissions = JSON.parse(adminRow.permissions);
    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions).toContain('manage_users');
    expect(permissions).toContain('manage_network');
    expect(permissions).toContain('manage_games');
  });

  test('seeded admin has persisted avatar config via Better-Auth', async () => {
    const adminRow = sqlite
      .prepare('SELECT avatar_config FROM operators WHERE username = ?')
      .get('admin') as { avatar_config: string | null };

    expect(adminRow.avatar_config).toBeDefined();

    const avatarConfig = JSON.parse(adminRow.avatar_config!);
    expect(avatarConfig).toHaveProperty('seed', 'admin');
    expect(avatarConfig).toHaveProperty('eyes');
    expect(avatarConfig).toHaveProperty('mouth');
  });
});
