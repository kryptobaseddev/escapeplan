import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/index.js';

let server: FastifyInstance;
let sessionCookie: string;

beforeAll(async () => {
  const { seedIdempotent } = await import('../src/db/seed.ts');
  await seedIdempotent();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
});

describe('Alert Rules API', () => {
  test('authenticates admin user', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/username',
      payload: { username: 'admin', password: 'escapeplan' }
    });

    expect(response.statusCode).toBe(200);
    const cookies = response.headers['set-cookie'];
    const rawCookie = Array.isArray(cookies) ? cookies[0] : cookies;
    sessionCookie = rawCookie?.split(';')[0] ?? '';
  });

  test('GET /api/admin/alert-rules returns all rules', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/admin/alert-rules',
      headers: { cookie: sessionCookie }
    });

    expect(response.statusCode).toBe(200);
    const json = response.json() as { rules: Array<{ id: string }> };
    expect(Array.isArray(json.rules)).toBe(true);
    expect(json.rules.length).toBeGreaterThan(0);
  });

  test('PATCH /api/admin/alert-rules/:id toggles enabled state', async () => {
    // First, get current rules
    const listResponse = await server.inject({
      method: 'GET',
      url: '/api/admin/alert-rules',
      headers: { cookie: sessionCookie }
    });

    const { rules } = listResponse.json() as { rules: Array<{ id: string; enabled: boolean }> };
    const testRule = rules[0];
    const originalState = testRule.enabled;

    // Toggle the rule
    const patchResponse = await server.inject({
      method: 'PATCH',
      url: `/api/admin/alert-rules/${testRule.id}`,
      headers: { cookie: sessionCookie },
      payload: { enabled: !originalState }
    });

    expect(patchResponse.statusCode).toBe(200);
    const patchJson = patchResponse.json() as { success: boolean };
    expect(patchJson.success).toBe(true);

    // Verify the change persisted
    const verifyResponse = await server.inject({
      method: 'GET',
      url: '/api/admin/alert-rules',
      headers: { cookie: sessionCookie }
    });

    const { rules: updatedRules } = verifyResponse.json() as {
      rules: Array<{ id: string; enabled: boolean }>
    };
    const updatedRule = updatedRules.find(r => r.id === testRule.id);
    expect(updatedRule?.enabled).toBe(!originalState);

    // Restore original state
    await server.inject({
      method: 'PATCH',
      url: `/api/admin/alert-rules/${testRule.id}`,
      headers: { cookie: sessionCookie },
      payload: { enabled: originalState }
    });
  });

  test('PATCH /api/admin/alert-rules/:id updates rule templates', async () => {
    const listResponse = await server.inject({
      method: 'GET',
      url: '/api/admin/alert-rules',
      headers: { cookie: sessionCookie }
    });

    const { rules } = listResponse.json() as {
      rules: Array<{
        id: string;
        title_template: string;
        message_template: string;
      }>;
    };
    const testRule = rules[0];
    const originalTitle = testRule.title_template;

    const newTitle = 'Updated Test Title';
    const patchResponse = await server.inject({
      method: 'PATCH',
      url: `/api/admin/alert-rules/${testRule.id}`,
      headers: { cookie: sessionCookie },
      payload: { title_template: newTitle }
    });

    expect(patchResponse.statusCode).toBe(200);

    // Verify update
    const verifyResponse = await server.inject({
      method: 'GET',
      url: '/api/admin/alert-rules',
      headers: { cookie: sessionCookie }
    });

    const { rules: updatedRules } = verifyResponse.json() as {
      rules: Array<{ id: string; title_template: string }>;
    };
    const updatedRule = updatedRules.find(r => r.id === testRule.id);
    expect(updatedRule?.title_template).toBe(newTitle);

    // Restore original
    await server.inject({
      method: 'PATCH',
      url: `/api/admin/alert-rules/${testRule.id}`,
      headers: { cookie: sessionCookie },
      payload: { title_template: originalTitle }
    });
  });

  test('PATCH /api/admin/alert-rules/:id requires authentication', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: '/api/admin/alert-rules/test-rule',
      payload: { enabled: false }
    });

    expect(response.statusCode).toBe(401);
  });
});
