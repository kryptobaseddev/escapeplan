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

  // Authenticate as admin
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
    sqlite.prepare('DELETE FROM session WHERE userId = ?').run(testOperatorId);
    sqlite.prepare('DELETE FROM account WHERE userId = ?').run(testOperatorId);
    sqlite.prepare('DELETE FROM user WHERE id = ?').run(testOperatorId);
  }
  await server.close();
});

describe('Email Optional Validation', () => {
  const randomSuffix = Date.now().toString(36);
  const testUsername = `noemail${randomSuffix}`;
  const testPassword = 'NoEmailTest123!';

  test('creates operator without email (undefined)', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminSessionCookie },
      payload: {
        username: testUsername,
        name: 'No Email Operator',
        password: testPassword,
        role: 'game_master',
        bio: 'Testing optional email',
        mustResetPassword: false
        // email is intentionally omitted
      }
    });

    expect(response.statusCode).toBe(200);
    const operator = response.json() as OperatorSummary;

    expect(operator.username).toBe(testUsername);
    expect(operator.role).toBe('game_master');

    testOperatorId = operator.id;
  });

  test('creates operator with empty string email', async () => {
    const usernameEmpty = `empty${randomSuffix}`;

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminSessionCookie },
      payload: {
        username: usernameEmpty,
        name: 'Empty Email Operator',
        email: '', // Empty string
        password: testPassword,
        role: 'game_master',
        mustResetPassword: false
      }
    });

    expect(response.statusCode).toBe(200);
    const operator = response.json() as OperatorSummary;

    expect(operator.username).toBe(usernameEmpty);

    // Clean up this second test operator
    sqlite.prepare('DELETE FROM session WHERE userId = ?').run(operator.id);
    sqlite.prepare('DELETE FROM account WHERE userId = ?').run(operator.id);
    sqlite.prepare('DELETE FROM user WHERE id = ?').run(operator.id);
  });

  test('rejects invalid email format', async () => {
    const usernameInvalid = `invalid${randomSuffix}`;

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminSessionCookie },
      payload: {
        username: usernameInvalid,
        name: 'Invalid Email Operator',
        email: 'not-an-email', // Invalid email
        password: testPassword,
        role: 'game_master',
        mustResetPassword: false
      }
    });

    expect(response.statusCode).toBe(400);
    const error = response.json() as { message?: string };
    expect(error.message).toContain('Invalid request');
  });
});
