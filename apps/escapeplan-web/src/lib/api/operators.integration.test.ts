import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BotttsAvatarConfig, OperatorSummary } from '@escapeplan/contracts';

// Mock API client
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Operator CRUD Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Create Operator with Avatar', () => {
    it('sends avatarConfig in create request', async () => {
      const avatarConfig: BotttsAvatarConfig = {
        seed: 'test-seed',
        eyes: ['happy'],
        mouth: ['smile01']
      };

      const requestData = {
        username: 'test.user',
        name: 'Test User',
        email: 'test@test.com',
        password: 'password123456',
        role: 'manager' as const,
        avatarConfig
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'new-user-id',
          ...requestData,
          permissions: ['view_dashboard'],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z'
        })
      });

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('/api/admin/users');
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toContain('"avatarConfig"');

      const data = await response.json();
      expect(data.avatarConfig).toEqual(avatarConfig);
    });

    it('receives avatarConfig in response', async () => {
      const avatarConfig: BotttsAvatarConfig = {
        seed: 'response-seed',
        eyes: ['happy'],
        mouth: ['smile01']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'user-123',
          username: 'created.user',
          name: 'Created User',
          email: 'created@test.com',
          role: 'manager',
          avatarConfig,
          permissions: [],
          mustResetPassword: false,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z'
        } as OperatorSummary)
      });

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: '123456789012' })
      });

      const operator = await response.json();
      expect(operator.avatarConfig).toBeDefined();
      expect(operator.avatarConfig.seed).toBe('response-seed');
    });
  });

  describe('Update Operator Avatar', () => {
    it('sends updated avatarConfig in PATCH request', async () => {
      const updatedConfig: BotttsAvatarConfig = {
        seed: 'updated-seed',
        eyes: ['sad'],
        mouth: ['frown']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'user-123',
          username: 'existing.user',
          name: 'Updated User',
          email: 'test@test.com',
          avatarConfig: updatedConfig,
          role: 'manager',
          permissions: [],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:01.000Z'
        })
      });

      const response = await fetch('/api/admin/users/user-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated User',
          avatarConfig: updatedConfig
        })
      });

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('/api/admin/users/user-123');
      expect(callArgs[1].method).toBe('PATCH');
      expect(callArgs[1].body).toContain('"updated-seed"');

      const data = await response.json();
      expect(data.avatarConfig.seed).toBe('updated-seed');
    });
  });

  describe('List Operators', () => {
    it('returns operators with avatarConfig', async () => {
      const operators: OperatorSummary[] = [
        {
          id: 'user-1',
          username: 'user1',
          name: 'User One',
          email: 'user1@test.com',
          role: 'admin',
          permissions: [],
          avatarConfig: { seed: 'seed1', eyes: ['happy'] },
          mustResetPassword: false,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z'
        },
        {
          id: 'user-2',
          username: 'user2',
          name: 'User Two',
          email: 'user2@test.com',
          role: 'manager',
          permissions: [],
          avatarConfig: { seed: 'seed2', mouth: ['smile01'] },
          mustResetPassword: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => operators
      });

      const response = await fetch('/api/admin/users');
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].avatarConfig).toBeDefined();
      expect(data[1].avatarConfig).toBeDefined();
      expect(data[0].avatarConfig.seed).toBe('seed1');
      expect(data[1].avatarConfig.seed).toBe('seed2');
    });
  });
});
