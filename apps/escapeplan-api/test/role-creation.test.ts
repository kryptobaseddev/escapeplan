import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/index.js';
import { sqlite } from '../src/db/client.js';

let server: FastifyInstance;
let adminSessionCookie: string;
const createdRoleIds: string[] = [];

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
  // Clean up created roles
  for (const roleId of createdRoleIds) {
    sqlite.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
    sqlite.prepare('DELETE FROM roles WHERE id = ?').run(roleId);
  }
  await server.close();
});

describe('Role Creation - Description Field Validation', () => {
  test('accepts role with description=null', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie: adminSessionCookie },
      payload: {
        name: 'Role with Null Description',
        description: null,
        permissionIds: []
      }
    });

    expect(response.statusCode).toBe(200);
    const role = response.json();
    expect(role.name).toBe('Role with Null Description');
    expect(role.description).toBeNull();
    createdRoleIds.push(role.id);

    // Verify database persistence
    const dbRow = sqlite
      .prepare('SELECT description FROM roles WHERE id = ?')
      .get(role.id) as { description: string | null };
    expect(dbRow.description).toBeNull();
  });

  test('accepts role with description=undefined (omitted)', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie: adminSessionCookie },
      payload: {
        name: 'Role with Omitted Description',
        permissionIds: []
      }
    });

    expect(response.statusCode).toBe(200);
    const role = response.json();
    expect(role.name).toBe('Role with Omitted Description');
    expect(role.description).toBeNull();
    createdRoleIds.push(role.id);
  });

  test('accepts role with valid string description', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie: adminSessionCookie },
      payload: {
        name: 'Role with Valid Description',
        description: 'This is a valid description',
        permissionIds: []
      }
    });

    expect(response.statusCode).toBe(200);
    const role = response.json();
    expect(role.name).toBe('Role with Valid Description');
    expect(role.description).toBe('This is a valid description');
    createdRoleIds.push(role.id);

    // Verify database persistence
    const dbRow = sqlite
      .prepare('SELECT description FROM roles WHERE id = ?')
      .get(role.id) as { description: string | null };
    expect(dbRow.description).toBe('This is a valid description');
  });

  test('accepts role with empty string description', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie: adminSessionCookie },
      payload: {
        name: 'Role with Empty Description',
        description: '',
        permissionIds: []
      }
    });

    expect(response.statusCode).toBe(200);
    const role = response.json();
    expect(role.name).toBe('Role with Empty Description');
    expect(role.description).toBe('');
    createdRoleIds.push(role.id);
  });

  test('accepts role with empty permissionIds array', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie: adminSessionCookie },
      payload: {
        name: 'Role without Permissions',
        description: null,
        permissionIds: []
      }
    });

    expect(response.statusCode).toBe(200);
    const role = response.json();
    expect(role.name).toBe('Role without Permissions');
    expect(role.description).toBeNull();
    expect(Array.isArray(role.permissions)).toBe(true);
    expect(role.permissions.length).toBe(0);
    createdRoleIds.push(role.id);

    // Verify no role_permissions records created
    const dbRow = sqlite
      .prepare('SELECT COUNT(*) as count FROM role_permissions WHERE role_id = ?')
      .get(role.id) as { count: number };
    expect(dbRow.count).toBe(0);
  });

  test('rejects role creation without name', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie: adminSessionCookie },
      payload: {
        description: 'Role without name',
        permissionIds: []
      }
    });

    expect(response.statusCode).toBe(400);
    const error = response.json();
    expect(error.message).toBe('Invalid request');
  });

  test('rejects role creation with empty name', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie: adminSessionCookie },
      payload: {
        name: '',
        description: null,
        permissionIds: []
      }
    });

    expect(response.statusCode).toBe(400);
    const error = response.json();
    expect(error.message).toBe('Invalid request');
  });
});

describe('Role Update - Description Field Validation', () => {
  let testRoleId: string;

  beforeAll(async () => {
    // Create a test role for update tests
    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie: adminSessionCookie },
      payload: {
        name: 'Test Role for Updates',
        description: 'Initial description',
        permissionIds: []
      }
    });

    const role = response.json();
    testRoleId = role.id;
    createdRoleIds.push(testRoleId);
  });

  test('updates role with description=null', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: `/api/admin/roles/${testRoleId}`,
      headers: { cookie: adminSessionCookie },
      payload: {
        description: null
      }
    });

    expect(response.statusCode).toBe(200);
    const role = response.json();
    expect(role.description).toBeNull();

    // Verify database persistence
    const dbRow = sqlite
      .prepare('SELECT description FROM roles WHERE id = ?')
      .get(testRoleId) as { description: string | null };
    expect(dbRow.description).toBeNull();
  });

  test('updates role with description=undefined (omitted)', async () => {
    // First, set a description
    await server.inject({
      method: 'PATCH',
      url: `/api/admin/roles/${testRoleId}`,
      headers: { cookie: adminSessionCookie },
      payload: {
        description: 'New description'
      }
    });

    // Then update without description field (should not change it)
    const response = await server.inject({
      method: 'PATCH',
      url: `/api/admin/roles/${testRoleId}`,
      headers: { cookie: adminSessionCookie },
      payload: {
        name: 'Updated Name'
      }
    });

    expect(response.statusCode).toBe(200);
    const role = response.json();
    expect(role.name).toBe('Updated Name');
    expect(role.description).toBe('New description'); // Should remain unchanged
  });

  test('updates role with valid string description', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: `/api/admin/roles/${testRoleId}`,
      headers: { cookie: adminSessionCookie },
      payload: {
        description: 'Updated description text'
      }
    });

    expect(response.statusCode).toBe(200);
    const role = response.json();
    expect(role.description).toBe('Updated description text');

    // Verify database persistence
    const dbRow = sqlite
      .prepare('SELECT description FROM roles WHERE id = ?')
      .get(testRoleId) as { description: string | null };
    expect(dbRow.description).toBe('Updated description text');
  });
});
