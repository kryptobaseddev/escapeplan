import { describe, it, expect, vi } from 'vitest';
import { apiFetch, ApiError } from './client';

// Mock fetch
const createMockFetch = (responseData: { ok?: boolean; status?: number; json?: any; text?: string }) => {
  return vi.fn().mockResolvedValue({
    ok: responseData.ok ?? true,
    status: responseData.status ?? 200,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue(responseData.json ?? {}),
    text: vi.fn().mockResolvedValue(responseData.text ?? '')
  });
};

describe('apiFetch URL Construction', () => {
  it('constructs URL correctly when path includes /api prefix', async () => {
    const mockFetch = createMockFetch({
      ok: true,
      status: 200,
      json: { success: true }
    });

    await apiFetch(mockFetch, '/api/admin/alert-rules/test', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false })
    });

    // Verify fetch was called with correct URL (no double /api/api/)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/alert-rules\/test$/),
      expect.any(Object)
    );

    // Verify NO double prefix
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/api/'),
      expect.any(Object)
    );
  });

  it('constructs URL correctly when path excludes /api prefix', async () => {
    const mockFetch = createMockFetch({
      ok: true,
      status: 200,
      json: { success: true }
    });

    await apiFetch(mockFetch, '/admin/users', {
      method: 'GET'
    });

    // Verify fetch was called with correct URL
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/users$/),
      expect.any(Object)
    );
  });

  it('handles alert rules toggle endpoint correctly', async () => {
    const mockFetch = createMockFetch({
      ok: true,
      status: 200,
      json: { success: true }
    });

    const ruleId = 'excessive_hints';
    await apiFetch(mockFetch, `/api/admin/alert-rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false })
    });

    const callUrl = mockFetch.mock.calls[0][0] as string;

    // Should NOT contain double /api/api/
    expect(callUrl).not.toContain('/api/api/');

    // Should contain single /api/admin/alert-rules/
    expect(callUrl).toContain('/api/admin/alert-rules/excessive_hints');
  });

  it('sets correct headers for JSON requests', async () => {
    const mockFetch = createMockFetch({ ok: true });

    await apiFetch(mockFetch, '/api/admin/alert-rules/test', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false })
    });

    const callOptions = mockFetch.mock.calls[0][1];
    const headers = callOptions.headers as Headers;

    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('includes credentials by default', async () => {
    const mockFetch = createMockFetch({ ok: true });

    await apiFetch(mockFetch, '/api/dashboard');

    const callOptions = mockFetch.mock.calls[0][1];
    expect(callOptions.credentials).toBe('include');
  });

  it('throws ApiError on non-ok response', async () => {
    const mockFetch = createMockFetch({
      ok: false,
      status: 404,
      json: { error: 'Route not found' }
    });

    await expect(
      apiFetch(mockFetch, '/api/admin/alert-rules/invalid')
    ).rejects.toThrow(ApiError);
  });

  it('handles 204 No Content response', async () => {
    const mockFetch = createMockFetch({
      ok: true,
      status: 204,
      json: null
    });

    const result = await apiFetch(mockFetch, '/api/admin/users/123', {
      method: 'DELETE'
    });

    expect(result).toBeUndefined();
  });
});

describe('ApiError class', () => {
  it('includes status code and details', () => {
    const error = new ApiError('Test error', 400, { field: 'username' });

    expect(error.message).toBe('Test error');
    expect(error.status).toBe(400);
    expect(error.details).toEqual({ field: 'username' });
  });
});
