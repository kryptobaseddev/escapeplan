import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/index.js';
import { sqlite } from '../src/db/client.js';

/**
 * Test suite for hint counter regression fix
 *
 * Verifies that the countAsHint flag is properly respected when sending hints:
 * - countAsHint: true should increment hints_used counter
 * - countAsHint: false should NOT increment hints_used counter
 * - countAsHint: undefined should default to true (increment counter)
 * - count_as_hint column should be stored in session_hints table
 */

let server: FastifyInstance;
let sessionCookie: string;
let testSessionId: string;
let testBookingId: string;

beforeAll(async () => {
  const { seedIdempotent } = await import('../src/db/seed.ts');
  const { seedSystemSettings } = await import('../src/db/seed-settings.ts');
  const { initializeSettings } = await import('../src/settings.ts');
  await seedIdempotent();
  await seedSystemSettings();
  await initializeSettings();
  server = await buildServer();

  // Authenticate as admin
  const authResponse = await server.inject({
    method: 'POST',
    url: '/api/auth/sign-in/username',
    payload: { username: 'admin', password: 'escapeplan' }
  });

  expect(authResponse.statusCode).toBe(200);
  const cookies = authResponse.headers['set-cookie'];
  const rawCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  sessionCookie = rawCookie?.split(';')[0] ?? '';

  // Create a test session
  const now = new Date();
  testBookingId = `test-booking-${now.getTime()}`;
  testSessionId = `test-session-${now.getTime()}`;

  const game = sqlite.prepare(`SELECT id FROM games WHERE slug = ?`).get('pirate-mutiny') as { id: string };

  sqlite.prepare(
    `INSERT INTO bookings (id, booking_code, game_id, start_time, end_time, status, party_size, deposit_due_cents, total_due_cents, price_tier, discount_code, is_mobile, location_note, contact_name, contact_phone)
     VALUES (?, ?, ?, ?, ?, 'checked_in', 4, 0, 0, 'standard', NULL, 0, NULL, 'Test Crew', '555-0100')`
  ).run(
    testBookingId,
    `HINT-TEST-${now.getTime()}`,
    game.id,
    new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    new Date(now.getTime() + 55 * 60 * 1000).toISOString()
  );

  sqlite.prepare(
    `INSERT INTO sessions (id, booking_id, status, timer_total_seconds, timer_remaining_seconds, timer_status, started_at, scheduled_end, hints_used, stream_thumbnail_url, background_audio_track, background_audio_is_playing, crew_primary, crew_support)
     VALUES (?, ?, 'running', 3600, 3300, 'running', ?, ?, 0, NULL, NULL, 0, 'Console Operator', NULL)`
  ).run(
    testSessionId,
    testBookingId,
    new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    new Date(now.getTime() + 55 * 60 * 1000).toISOString()
  );
});

afterAll(async () => {
  // Clean up test data
  sqlite.prepare(`DELETE FROM session_hints WHERE session_id = ?`).run(testSessionId);
  sqlite.prepare(`DELETE FROM session_puzzles WHERE session_id = ?`).run(testSessionId);
  sqlite.prepare(`DELETE FROM sessions WHERE id = ?`).run(testSessionId);
  sqlite.prepare(`DELETE FROM bookings WHERE id = ?`).run(testBookingId);
  await server.close();
});

describe('Hint Counter with countAsHint flag', () => {
  test('sends hint with countAsHint: true and increments hints_used', async () => {
    // Get current hints_used count
    const beforeSession = sqlite.prepare(`SELECT hints_used FROM sessions WHERE id = ?`).get(testSessionId) as { hints_used: number };
    const hintsBefore = beforeSession.hints_used;

    // Send hint with countAsHint: true
    const response = await server.inject({
      method: 'POST',
      url: `/api/sessions/${testSessionId}/commands`,
      headers: { cookie: sessionCookie },
      payload: {
        command: 'send_hint',
        payload: {
          medium: 'text',
          message: 'Test hint with countAsHint true',
          countAsHint: true
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const json = response.json() as { status: string; session: { hintsUsed: number } };
    expect(json.status).toBe('ok');

    // Verify hints_used was incremented
    expect(json.session.hintsUsed).toBe(hintsBefore + 1);

    // Verify the hint was stored with count_as_hint = 1
    const hint = sqlite.prepare(
      `SELECT count_as_hint FROM session_hints WHERE session_id = ? ORDER BY delivered_at DESC LIMIT 1`
    ).get(testSessionId) as { count_as_hint: number };

    expect(hint.count_as_hint).toBe(1);
  });

  test('sends hint with countAsHint: false and does NOT increment hints_used', async () => {
    // Get current hints_used count
    const beforeSession = sqlite.prepare(`SELECT hints_used FROM sessions WHERE id = ?`).get(testSessionId) as { hints_used: number };
    const hintsBefore = beforeSession.hints_used;

    // Send hint with countAsHint: false
    const response = await server.inject({
      method: 'POST',
      url: `/api/sessions/${testSessionId}/commands`,
      headers: { cookie: sessionCookie },
      payload: {
        command: 'send_hint',
        payload: {
          medium: 'text',
          message: 'Test hint with countAsHint false',
          countAsHint: false
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const json = response.json() as { status: string; session: { hintsUsed: number } };
    expect(json.status).toBe('ok');

    // Verify hints_used was NOT incremented
    expect(json.session.hintsUsed).toBe(hintsBefore);

    // Verify the hint was stored with count_as_hint = 0
    const hint = sqlite.prepare(
      `SELECT count_as_hint FROM session_hints WHERE session_id = ? ORDER BY delivered_at DESC LIMIT 1`
    ).get(testSessionId) as { count_as_hint: number };

    expect(hint.count_as_hint).toBe(0);
  });

  test('sends hint with countAsHint: undefined (defaults to true) and increments hints_used', async () => {
    // Get current hints_used count
    const beforeSession = sqlite.prepare(`SELECT hints_used FROM sessions WHERE id = ?`).get(testSessionId) as { hints_used: number };
    const hintsBefore = beforeSession.hints_used;

    // Send hint without countAsHint field (should default to true)
    const response = await server.inject({
      method: 'POST',
      url: `/api/sessions/${testSessionId}/commands`,
      headers: { cookie: sessionCookie },
      payload: {
        command: 'send_hint',
        payload: {
          medium: 'text',
          message: 'Test hint with countAsHint undefined'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const json = response.json() as { status: string; session: { hintsUsed: number } };
    expect(json.status).toBe('ok');

    // Verify hints_used was incremented (defaulted to true)
    expect(json.session.hintsUsed).toBe(hintsBefore + 1);

    // Verify the hint was stored with count_as_hint = 1
    const hint = sqlite.prepare(
      `SELECT count_as_hint FROM session_hints WHERE session_id = ? ORDER BY delivered_at DESC LIMIT 1`
    ).get(testSessionId) as { count_as_hint: number };

    expect(hint.count_as_hint).toBe(1);
  });

  test('sends multiple hints with mixed countAsHint values and tracks correctly', async () => {
    // Get initial count
    const beforeSession = sqlite.prepare(`SELECT hints_used FROM sessions WHERE id = ?`).get(testSessionId) as { hints_used: number };
    const initialCount = beforeSession.hints_used;

    // Send hint 1: countAsHint = true
    await server.inject({
      method: 'POST',
      url: `/api/sessions/${testSessionId}/commands`,
      headers: { cookie: sessionCookie },
      payload: {
        command: 'send_hint',
        payload: { medium: 'text', message: 'Hint 1', countAsHint: true }
      }
    });

    // Send hint 2: countAsHint = false
    await server.inject({
      method: 'POST',
      url: `/api/sessions/${testSessionId}/commands`,
      headers: { cookie: sessionCookie },
      payload: {
        command: 'send_hint',
        payload: { medium: 'text', message: 'Hint 2', countAsHint: false }
      }
    });

    // Send hint 3: countAsHint = true
    await server.inject({
      method: 'POST',
      url: `/api/sessions/${testSessionId}/commands`,
      headers: { cookie: sessionCookie },
      payload: {
        command: 'send_hint',
        payload: { medium: 'text', message: 'Hint 3', countAsHint: true }
      }
    });

    // Send hint 4: countAsHint = false
    const response = await server.inject({
      method: 'POST',
      url: `/api/sessions/${testSessionId}/commands`,
      headers: { cookie: sessionCookie },
      payload: {
        command: 'send_hint',
        payload: { medium: 'text', message: 'Hint 4', countAsHint: false }
      }
    });

    expect(response.statusCode).toBe(200);
    const json = response.json() as { status: string; session: { hintsUsed: number } };

    // Should have incremented by 2 (hint 1 and hint 3 only)
    expect(json.session.hintsUsed).toBe(initialCount + 2);

    // Verify all 4 hints were stored with correct count_as_hint values
    const hints = sqlite.prepare(
      `SELECT count_as_hint, message FROM session_hints WHERE session_id = ? ORDER BY delivered_at DESC LIMIT 4`
    ).all(testSessionId) as Array<{ count_as_hint: number; message: string }>;

    // Order is reversed (DESC), so Hint 4 is first
    expect(hints[0].message).toContain('Hint 4');
    expect(hints[0].count_as_hint).toBe(0);
    expect(hints[1].message).toContain('Hint 3');
    expect(hints[1].count_as_hint).toBe(1);
    expect(hints[2].message).toContain('Hint 2');
    expect(hints[2].count_as_hint).toBe(0);
    expect(hints[3].message).toContain('Hint 1');
    expect(hints[3].count_as_hint).toBe(1);
  });

  test('ensures count_as_hint column exists in database schema', async () => {
    // Verify the column exists by querying pragma
    const columns = sqlite.prepare(`PRAGMA table_info(session_hints)`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const countAsHintColumn = columns.find(col => col.name === 'count_as_hint');
    expect(countAsHintColumn).toBeDefined();
    expect(countAsHintColumn?.type).toBe('INTEGER');
    expect(countAsHintColumn?.notnull).toBe(1); // NOT NULL
    const defaultValue = String(countAsHintColumn?.dflt_value ?? '').toLowerCase();
    expect(['1', 'true'].includes(defaultValue)).toBe(true);
  });
});
