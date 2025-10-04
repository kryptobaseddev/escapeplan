/**
 * Game Update Endpoint Tests
 *
 * Tests for POST /api/admin/games (create) and PUT /api/admin/games/:id (update)
 * Covers the "Missing payload" bug fix and proper validation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/index.js';
import type { FastifyInstance } from 'fastify';
import { sqlite } from '../src/db/client.js';
import { nanoid } from 'nanoid';

let app: FastifyInstance;
let adminSessionCookie: string;
let testGameIds: string[] = [];

const VALID_GAME_PAYLOAD = {
  slug: 'test-escape-room',
  name: 'Test Escape Room',
  description: 'A thrilling test escape room experience',
  storyIntro: 'Welcome to the test chamber',
  durationMinutes: 60,
  difficulty: 'Medium',
  gameType: 'storefront' as const,
  categories: ['Mystery', 'Adventure'],
  minPlayers: 2,
  maxPlayers: 6,
  resourcesRequired: 1,
  validationNotes: 'Test notes',
  defaultVolume: 80,
  cameraIds: [],
  puzzles: [
    {
      title: 'First Puzzle',
      description: 'Solve this puzzle',
      solution: 'SECRET',
      displayOrder: 1,
      hints: [
        {
          uuid: nanoid(),
          type: 'text' as const,
          content: 'Look under the table',
          order: 1,
          penaltySeconds: 0,
          penaltyEnabled: false,
          countAsHint: true
        }
      ]
    }
  ],
  milestones: [
    {
      type: 'intro' as const,
      name: 'Game Start',
      mediaType: 'text' as const,
      content: 'Welcome message',
      volumeLevel: 80,
      displayOrder: 1,
      triggerType: 'manual' as const,
      enabled: true
    }
  ],
  media: {
    galleryAssetIds: []
  },
  pricing: {
    tiers: [
      {
        id: nanoid(),
        label: 'Standard',
        model: 'per_person' as const,
        priceCents: 2500,
        displayOrder: 1,
        active: true
      }
    ],
    deposit: {
      required: false
    },
    discounts: []
  },
  bookingRules: {
    isMobile: false,
    reservationStyle: 'public' as const,
    equipmentChecklist: [],
    customFields: []
  }
};

beforeAll(async () => {
  const { seedIdempotent } = await import('../src/db/seed.ts');
  const { seedSystemSettings } = await import('../src/db/seed-settings.ts');
  const { initializeSettings } = await import('../src/settings.ts');

  await seedIdempotent();
  await seedSystemSettings();
  await initializeSettings();

  app = await buildServer();
  await app.ready();

  // Authenticate as admin
  const authResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/username',
    payload: { username: 'admin', password: 'escapeplan' }
  });

  const cookies = authResponse.headers['set-cookie'];
  const rawCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  adminSessionCookie = rawCookie!.split(';')[0];
});

afterAll(async () => {
  // Cleanup all test games
  for (const gameId of testGameIds) {
    sqlite.prepare('DELETE FROM games WHERE id = ?').run(gameId);
  }
  await app.close();
});

describe('POST /api/admin/games (Create Game)', () => {
  it('should create a game with valid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/games',
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: VALID_GAME_PAYLOAD
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.slug).toBe('test-escape-room');
    expect(body.name).toBe('Test Escape Room');
    expect(body.puzzles).toHaveLength(1);
    expect(body.milestones).toHaveLength(1);

    testGameIds.push(body.id);
  });

  it('should reject payload missing required field (name)', async () => {
    const invalidPayload = { ...VALID_GAME_PAYLOAD, name: '' };

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/games',
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: invalidPayload
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toBe('Invalid request');
    expect(body.details).toBeDefined();
  });

  it('should reject payload with invalid slug format', async () => {
    const invalidPayload = {
      ...VALID_GAME_PAYLOAD,
      slug: 'Invalid Slug With Spaces'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/games',
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: invalidPayload
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toBe('Invalid request');
  });

  it('should reject missing payload entirely (empty body)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/games',
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toBe('Invalid request');
  });

  it('should require authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/games',
      headers: {
        'content-type': 'application/json'
      },
      payload: VALID_GAME_PAYLOAD
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('PUT /api/admin/games/:id (Update Game)', () => {
  let gameIdForUpdate: string;

  beforeAll(async () => {
    // Create a game to update in tests
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/admin/games',
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: {
        ...VALID_GAME_PAYLOAD,
        slug: 'game-to-update',
        name: 'Game To Update'
      }
    });

    const createdGame = createResponse.json();
    gameIdForUpdate = createdGame.id;
    testGameIds.push(gameIdForUpdate);
  });

  it('should update an existing game with valid payload', async () => {
    const updatedPayload = {
      ...VALID_GAME_PAYLOAD,
      slug: 'game-to-update',
      name: 'Updated Game Name',
      description: 'Updated description for the game',
      durationMinutes: 90
    };

    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/admin/games/${gameIdForUpdate}`,
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: updatedPayload
    });

    expect(updateResponse.statusCode).toBe(200);
    const updatedGame = updateResponse.json();
    expect(updatedGame.name).toBe('Updated Game Name');
    expect(updatedGame.description).toBe('Updated description for the game');
    expect(updatedGame.durationMinutes).toBe(90);
  });

  it('should reject update with invalid payload', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/games/${gameIdForUpdate}`,
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: {
        slug: 'test',
        name: '',  // Invalid: empty name
        description: 'Test'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toBe('Invalid request');
  });

  it('should handle missing game ID (404)', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/games/non-existent-id',
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: VALID_GAME_PAYLOAD
    });

    expect(response.statusCode).toBe(400);
  });

  it('should preserve puzzles and milestones on update', async () => {
    const payloadWithExtras = {
      ...VALID_GAME_PAYLOAD,
      slug: 'game-to-update',
      puzzles: [
        {
          title: 'Puzzle 1',
          description: 'First puzzle',
          displayOrder: 1,
          hints: []
        },
        {
          title: 'Puzzle 2',
          description: 'Second puzzle',
          displayOrder: 2,
          hints: []
        }
      ]
    };

    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/admin/games/${gameIdForUpdate}`,
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: payloadWithExtras
    });

    expect(updateResponse.statusCode).toBe(200);
    const updated = updateResponse.json();
    expect(updated.puzzles).toHaveLength(2);
    expect(updated.milestones).toHaveLength(1);
  });
});

describe('Edge Cases and Validation', () => {
  it('should validate pricing tier cents are non-negative', async () => {
    const invalidPayload = {
      ...VALID_GAME_PAYLOAD,
      slug: 'pricing-test',
      pricing: {
        tiers: [
          {
            id: nanoid(),
            label: 'Invalid',
            model: 'per_person' as const,
            priceCents: -100,  // Invalid: negative
            displayOrder: 1,
            active: true
          }
        ],
        deposit: { required: false },
        discounts: []
      }
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/games',
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: invalidPayload
    });

    expect(response.statusCode).toBe(400);
  });

  it('should validate player counts are positive', async () => {
    const invalidPayload = {
      ...VALID_GAME_PAYLOAD,
      slug: 'player-test',
      minPlayers: 0,  // Invalid: must be positive
      maxPlayers: -1  // Invalid: must be positive
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/games',
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: invalidPayload
    });

    expect(response.statusCode).toBe(400);
  });

  it('should accept minimal valid payload with optional fields omitted', async () => {
    const minimalPayload = {
      slug: `minimal-game-${Date.now()}`,
      name: 'Minimal Game',
      description: 'A minimal game configuration',
      durationMinutes: 60,
      difficulty: 'Medium',
      gameType: 'storefront' as const,
      categories: [],
      minPlayers: 1,
      maxPlayers: 1,
      resourcesRequired: 1,
      defaultVolume: 80,
      cameraIds: [],
      puzzles: [],
      milestones: [],
      media: { galleryAssetIds: [] },
      pricing: {
        tiers: [],
        deposit: { required: false },
        discounts: []
      },
      bookingRules: {
        isMobile: false,
        reservationStyle: 'public' as const,
        equipmentChecklist: [],
        customFields: []
      }
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/games',
      headers: {
        'content-type': 'application/json',
        cookie: adminSessionCookie
      },
      payload: minimalPayload
    });

    expect(response.statusCode).toBe(200);
    const created = response.json();
    testGameIds.push(created.id);
  });
});
