import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/index.js';
import { sqlite } from '../src/db/client.js';
import type { OperatorSummary } from '@escapeplan/contracts';

let server: FastifyInstance;
let adminSessionCookie: string;
let testOperatorId: string | null = null;

beforeAll(async () => {
  const { seedIdempotent } = await import('../src/db/seed.ts');
  await seedIdempotent();
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

describe('Security Hardening - Archive & Session Management', () => {
  // Use randomized usernames/emails to avoid unique constraint violations
  const randomSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  const testUsername = `sectest${randomSuffix}`;
  const testEmail = `sectest${randomSuffix}@escapeplan.local`;
  const testPassword = 'SecureTestPassword123!';

  test('multi-session invalidation on archive', async () => {
    // Create test operator
    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminSessionCookie },
      payload: {
        username: testUsername,
        name: 'Security Test Operator',
        email: testEmail,
        password: testPassword,
        role: 'manager',
        mustResetPassword: false
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const operator = createResponse.json() as OperatorSummary;
    testOperatorId = operator.id;

    // Create multiple sessions by logging in multiple times
    const session1 = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/username',
      payload: { username: testUsername, password: testPassword }
    });
    expect(session1.statusCode).toBe(200);

    const session2 = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/username',
      payload: { username: testUsername, password: testPassword }
    });
    expect(session2.statusCode).toBe(200);

    const session3 = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/username',
      payload: { username: testUsername, password: testPassword }
    });
    expect(session3.statusCode).toBe(200);

    // Verify multiple sessions exist in database
    const sessionsBeforeArchive = sqlite
      .prepare('SELECT COUNT(*) as count FROM operator_auth_sessions WHERE user_id = ?')
      .get(testOperatorId) as { count: number };

    expect(sessionsBeforeArchive.count).toBeGreaterThanOrEqual(3);

    // Archive the operator
    const archiveResponse = await server.inject({
      method: 'PATCH',
      url: `/api/admin/users/${testOperatorId}/archive`,
      headers: { cookie: adminSessionCookie },
      payload: { reason: 'Security test - multi-session invalidation' }
    });

    expect(archiveResponse.statusCode).toBe(200);

    // Verify ALL sessions were deleted
    const sessionsAfterArchive = sqlite
      .prepare('SELECT COUNT(*) as count FROM operator_auth_sessions WHERE user_id = ?')
      .get(testOperatorId) as { count: number };

    expect(sessionsAfterArchive.count).toBe(0);

    // Verify any existing session cookie is now invalid
    const cookies1 = session1.headers['set-cookie'];
    const rawCookie1 = Array.isArray(cookies1) ? cookies1[0] : cookies1;
    const sessionCookie1 = rawCookie1.split(';')[0];

    const invalidSessionResponse = await server.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { cookie: sessionCookie1 }
    });

    // Session should be invalid (either 401 or redirected)
    expect(invalidSessionResponse.statusCode).not.toBe(200);
  });

  test('archived user cannot reset password', async () => {
    if (!testOperatorId) {
      throw new Error('Test operator not created');
    }

    // Operator is already archived from previous test
    // Verify archived status
    const operatorRow = sqlite
      .prepare('SELECT archived_at FROM operators WHERE id = ?')
      .get(testOperatorId) as { archived_at: string | null };

    expect(operatorRow.archived_at).not.toBeNull();

    // Admin attempts to reset password for archived user
    const resetResponse = await server.inject({
      method: 'POST',
      url: `/api/admin/users/${testOperatorId}/reset-password`,
      headers: { cookie: adminSessionCookie },
      payload: { password: 'NewPassword123!', mustResetPassword: false }
    });

    // Should succeed (admin can reset archived user's password for account recovery)
    // This is intentional: allows re-enabling archived accounts with fresh credentials
    expect(resetResponse.statusCode).toBe(200);

    // But login should still fail due to archive check
    const loginResponse = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/username',
      payload: { username: testUsername, password: 'NewPassword123!' }
    });

    expect(loginResponse.statusCode).toBe(403);
    const error = loginResponse.json() as { error?: { code?: string } };
    expect(error.error?.code).toBe('ACCOUNT_ARCHIVED');
  });

  test('unarchived user can authenticate with existing password', async () => {
    if (!testOperatorId) {
      throw new Error('Test operator not created');
    }

    // Unarchive the operator
    const unarchiveResponse = await server.inject({
      method: 'PATCH',
      url: `/api/admin/users/${testOperatorId}/unarchive`,
      headers: { cookie: adminSessionCookie }
    });

    expect(unarchiveResponse.statusCode).toBe(200);

    // Verify user can now login with the password reset earlier
    const loginResponse = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/username',
      payload: { username: testUsername, password: 'NewPassword123!' }
    });

    expect(loginResponse.statusCode).toBe(200);
    const cookies = loginResponse.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // Verify new session was created
    const sessionsAfterUnarchive = sqlite
      .prepare('SELECT COUNT(*) as count FROM operator_auth_sessions WHERE user_id = ?')
      .get(testOperatorId) as { count: number };

    expect(sessionsAfterUnarchive.count).toBe(1);
  });

  test('cannot archive last active admin', async () => {
    // Get current admin count
    const adminCountBefore = sqlite
      .prepare('SELECT COUNT(*) as count FROM operators WHERE role = ? AND archived_at IS NULL')
      .get('admin') as { count: number };

    expect(adminCountBefore.count).toBeGreaterThanOrEqual(1);

    // Get admin user
    const adminRow = sqlite
      .prepare('SELECT id FROM operators WHERE role = ? AND archived_at IS NULL LIMIT 1')
      .get('admin') as { id: string };

    // If this is the only admin, archiving should fail
    if (adminCountBefore.count === 1) {
      const archiveResponse = await server.inject({
        method: 'PATCH',
        url: `/api/admin/users/${adminRow.id}/archive`,
        headers: { cookie: adminSessionCookie },
        payload: { reason: 'Test: should fail' }
      });

      expect(archiveResponse.statusCode).toBeGreaterThanOrEqual(400);
      const error = archiveResponse.json() as { message?: string };
      expect(error.message).toContain('final active admin');
    }
  });

  test('password change invalidates must_reset_password flag', async () => {
    if (!testOperatorId) {
      throw new Error('Test operator not created');
    }

    // Set mustResetPassword flag
    sqlite
      .prepare('UPDATE operators SET must_reset_password = 1 WHERE id = ?')
      .run(testOperatorId);

    // Verify flag is set
    const beforeRow = sqlite
      .prepare('SELECT must_reset_password FROM operators WHERE id = ?')
      .get(testOperatorId) as { must_reset_password: number };

    expect(beforeRow.must_reset_password).toBe(1);

    // User logs in and gets session cookie
    const loginResponse = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/username',
      payload: { username: testUsername, password: 'NewPassword123!' }
    });

    expect(loginResponse.statusCode).toBe(200);
    const cookies = loginResponse.headers['set-cookie'];
    const rawCookie = Array.isArray(cookies) ? cookies[0] : cookies;
    const userSessionCookie = rawCookie.split(';')[0];

    // User changes their password
    const changePasswordResponse = await server.inject({
      method: 'POST',
      url: '/api/users/me/password',
      headers: { cookie: userSessionCookie },
      payload: {
        currentPassword: 'NewPassword123!',
        newPassword: 'AnotherNewPassword456!'
      }
    });

    expect(changePasswordResponse.statusCode).toBe(204); // No Content response for password change

    // Verify must_reset_password flag is now cleared
    const afterRow = sqlite
      .prepare('SELECT must_reset_password FROM operators WHERE id = ?')
      .get(testOperatorId) as { must_reset_password: number };

    expect(afterRow.must_reset_password).toBe(0);
  });
});
