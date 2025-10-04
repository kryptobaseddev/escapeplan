import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/index.js';
import { sqlite } from '../src/db/client.js';

let server: FastifyInstance;
let sessionCookie: string;
let sessionFixture: { bookingId: string; sessionId: string; timerSlug: string } | null = null;

beforeAll(async () => {
  const { seedIdempotent } = await import('../src/db/seed.ts');
  await seedIdempotent();
  server = await buildServer();
});

afterAll(async () => {
  if (sessionFixture) {
    sqlite.prepare(`DELETE FROM timer_slugs WHERE slug = ?`).run(sessionFixture.timerSlug);
    sqlite.prepare(`DELETE FROM session_hints WHERE session_id = ?`).run(sessionFixture.sessionId);
    sqlite.prepare(`DELETE FROM session_puzzles WHERE session_id = ?`).run(sessionFixture.sessionId);
    sqlite.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionFixture.sessionId);
    sqlite.prepare(`DELETE FROM bookings WHERE id = ?`).run(sessionFixture.bookingId);
  }
  await server.close();
});

describe('EscapePlan API', () => {
  test('authenticates operator and establishes session', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/username',
      payload: { username: 'admin', password: 'escapeplan' }
    });

    expect(response.statusCode).toBe(200);
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const rawCookie = Array.isArray(cookies) ? cookies[0] : cookies;
    expect(rawCookie).toContain('better-auth.session_token');
    sessionCookie = rawCookie?.split(';')[0] ?? '';
  });

  test('returns dashboard data', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { cookie: sessionCookie }
    });

    expect(response.statusCode).toBe(200);
    const json = response.json() as { activeSessions: unknown[]; upcomingBookings: unknown[] };
    expect(Array.isArray(json.activeSessions)).toBe(true);
    expect(Array.isArray(json.upcomingBookings)).toBe(true);
  });

  test('provides timer broadcast for slug', async () => {
    if (!sessionFixture) {
      const now = new Date();
      const bookingId = `booking-${now.getTime()}`;
      const sessionId = `session-${now.getTime()}`;
      const timerSlug = 'pirate-mutiny-live';

      const game = sqlite.prepare(`SELECT id FROM games WHERE slug = ?`).get('pirate-mutiny') as { id: string };

      sqlite.prepare(
        `INSERT INTO bookings (id, booking_code, game_id, start_time, end_time, status, party_size, deposit_due_cents, total_due_cents, price_tier, discount_code, is_mobile, location_note, contact_name, contact_phone)
         VALUES (?, ?, ?, ?, ?, 'checked_in', 4, 0, 0, 'standard', NULL, 0, NULL, 'Test Crew', '555-0100')`
      ).run(
        bookingId,
        `TEST-${now.getTime()}`,
        game.id,
        new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        new Date(now.getTime() + 55 * 60 * 1000).toISOString()
      );

      sqlite.prepare(
        `INSERT INTO sessions (id, booking_id, status, timer_total_seconds, timer_remaining_seconds, timer_status, started_at, scheduled_end, hints_used, stream_thumbnail_url, background_audio_track, background_audio_is_playing, crew_primary, crew_support)
         VALUES (?, ?, 'running', 3600, 3300, 'running', ?, ?, 0, NULL, NULL, 0, 'Console Operator', NULL)`
      ).run(
        sessionId,
        bookingId,
        new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        new Date(now.getTime() + 55 * 60 * 1000).toISOString()
      );

      sqlite.prepare(`INSERT INTO timer_slugs (slug, session_id, narrative) VALUES (?, ?, ?)`)
        .run(timerSlug, sessionId, 'Live mission feed.');

      sessionFixture = { bookingId, sessionId, timerSlug };
    }

    const response = await server.inject({
      method: 'GET',
      url: `/api/public/room/${sessionFixture!.timerSlug}`
    });
    expect(response.statusCode).toBe(200);
    const json = response.json() as { slug: string };
    expect(json.slug).toBe(sessionFixture!.timerSlug);
  });
});
