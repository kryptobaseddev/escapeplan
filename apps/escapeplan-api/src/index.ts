import Fastify, { type FastifyReply, type FastifyRequest, type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import argon2 from 'argon2';
import { z } from 'zod';
import type { CommandRequest, OperatorPermission, OperatorRole, SaveGameRequest, ApplyNetworkConfigRequest, ApplyNetworkConfigResponse } from '@escapeplan/contracts';
import {
  applyCommand,
  changeOwnPassword,
  createGame,
  createOperatorAccount,
  deleteGame,
  deleteOperatorAccount,
  findOperatorByUsername,
  getGameDetails,
  getBookingsByDate,
  getDashboard,
  getSessionById,
  getSessionBySlug,
  getNetworkProfile,
  listGameDetails,
  listActiveSessions,
  listSessions,
  listOperatorSummaries,
  listRoles,
  listPermissions,
  quickStartSession,
  toTimerBroadcast,
  updateGame,
  updateNetworkProfile,
  updateOperatorAccount,
  updateOwnProfile,
  updateOperatorLoginTimestamp,
  resetOperatorPassword
} from './state/index.js';
import { auth, describeSession, issueToken, validateToken } from './auth.js';
import { runMigrations } from './db/client.js';
import { attachRealtime, emitDashboardUpdate, emitSessionUpdate, emitTimerUpdate } from './realtime.js';
import { applyEscapePlanConfig } from './platform.js';
import { loggerConfig, logError, logSecurityEvent } from './logger.js';
import { settings } from './settings.js';
import { getCurrentSystemHealth } from './system/health.js';

const DEFAULT_PORT = Number(process.env.PORT ?? 4000);

const operatorRoleValues = ['admin', 'manager', 'game_master', 'customer'] as const;

const createUserSchema = z.object({
  username: z.string().min(2),
  name: z.string().min(1),
  role: z.enum(operatorRoleValues),
  password: z.string().min(12),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  mustResetPassword: z.boolean().optional()
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(operatorRoleValues).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional().or(z.literal(null)),
  bio: z.string().max(500).optional().or(z.literal(null)),
  mustResetPassword: z.boolean().optional()
});

const resetPasswordSchema = z.object({
  password: z.string().min(12),
  forceReset: z.boolean().optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(12)
});

const updateOwnProfileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal(null)),
  avatarUrl: z.string().url().optional().or(z.literal(null)),
  bio: z.string().max(500).optional().or(z.literal(null))
});

const puzzleSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  solution: z.string().optional(),
  mediaAsset: z.string().optional(),
  operatorActions: z.string().optional(),
  displayOrder: z.number().int().nonnegative().optional()
});

const roomSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  isMobileCapable: z.boolean(),
  themeToken: z.string().optional()
});

const saveGameSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().min(1),
  storyIntro: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  difficulty: z.string().min(1),
  pricingModel: z.string().min(1),
  categories: z.array(z.string().min(1)).optional().default([]),
  minPlayers: z.number().int().positive(),
  maxPlayers: z.number().int().positive(),
  pricePerPlayerCents: z.number().int().nonnegative(),
  resourcesRequired: z.number().int().positive(),
  validationNotes: z.string().optional(),
  puzzles: z.array(puzzleSchema).optional().default([]),
  rooms: z.array(roomSchema).optional().default([])
});

const networkUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  ssid: z.string().min(1).optional(),
  description: z.string().optional(),
  band: z.string().optional(),
  channel: z.number().int().positive().optional(),
  security: z.string().optional(),
  broadcastEnabled: z.boolean().optional(),
  status: z.enum(['online', 'degraded', 'offline']).optional(),
  statusMessage: z.string().optional(),
  details: z.string().optional()
});

const keyValueSchema = z.record(z.string());

const networkProvisionSchema = z.object({
  wifi: z.object({
    ssid: z.string().min(1),
    passphrase: z.string().min(8).max(63),
    channel: z.number().int().positive().max(165),
    band: z.enum(['2g', '5g', 'auto']).default('auto'),
    country: z.string().length(2).optional()
  }),
  network: z.object({
    router: z.string().min(1),
    dns: z.string().min(1),
    dhcpRangeStart: z.string().min(1),
    dhcpRangeEnd: z.string().min(1),
    domain: z.string().min(1)
  }),
  nginx: z.object({
    serverName: z.string().min(1),
    apiUpstream: z.string().min(1),
    webRoot: z.string().min(1).optional(),
    webUpstream: z.string().min(1).optional()
  }),
  env: z
    .object({
      api: keyValueSchema.optional(),
      web: keyValueSchema.optional()
    })
    .optional(),
  services: z
    .object({
      enableApi: z.boolean().optional(),
      enableWeb: z.boolean().optional(),
      enableWifi: z.boolean().optional()
    })
    .optional()
});

async function ensureAuth(request: FastifyRequest, reply: FastifyReply) {
  // First, try to get session from Better Auth cookies
  try {
    const session = await auth.api.getSession({
      headers: request.headers as any
    });

    if (session?.user && session?.session) {
      // Better Auth session is valid
      const user = session.user as any;
      return {
        token: session.session.token,
        user: {
          id: user.id,
          username: user.username || user.email?.split('@')[0] || 'unknown',
          name: user.name || 'Unknown',
          role: user.role,
          permissions: user.permissions || [],
          mustResetPassword: false
        }
      };
    }
  } catch (error) {
    // Better Auth session check failed, continue to Bearer token fallback
  }

  // Fallback to Bearer token validation (for existing tests and legacy clients)
  const authHeader = request.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ statusCode: 401, message: 'Missing Authorization header' });
    return null;
  }
  const token = authHeader.split(' ')[1] ?? '';
  const user = validateToken(token);
  if (!user) {
    reply.status(401).send({ statusCode: 401, message: 'Session expired' });
    return null;
  }
  return { token, user };
}

function ensurePermission(reply: FastifyReply, userRole: OperatorRole, userPermissions: OperatorPermission[], permission: OperatorPermission, logger: FastifyBaseLogger, userId: string) {
  if (userRole === 'admin' || userPermissions.includes(permission)) {
    return true;
  }
  logSecurityEvent(logger, {
    type: 'permission_denied',
    userId,
    details: `User lacks permission: ${permission}`
  });
  reply.status(403).send({ statusCode: 403, message: 'Permission denied' });
  return false;
}

export async function buildServer() {
  await runMigrations();
  await settings.init();
  const app = Fastify({
    logger: loggerConfig,
    requestIdLogLabel: 'reqId',
    requestIdHeader: 'x-request-id',
    genReqId: (req) => req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  });

  await app.register(cors, { origin: true });

  // Register Better Auth handler for all /api/auth/* routes
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      try {
        // Construct request URL
        const url = new URL(request.url, `http://${request.headers.host}`);

        // Convert Fastify headers to standard Headers object
        const headers = new Headers();
        Object.entries(request.headers).forEach(([key, value]) => {
          if (value) {
            headers.append(key, Array.isArray(value) ? value.join(', ') : String(value));
          }
        });

        // Create Fetch API-compatible request
        const webRequest = new Request(url.toString(), {
          method: request.method,
          headers,
          body: request.body ? JSON.stringify(request.body) : undefined,
        });

        // Process authentication request with Better Auth
        const response = await auth.handler(webRequest);

        // Forward response to client
        reply.status(response.status);
        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });

        const body = await response.text();
        reply.send(body || null);

      } catch (error) {
        request.log.error({ error }, 'Better Auth Error');
        reply.status(500).send({
          error: 'Internal authentication error',
          code: 'AUTH_FAILURE'
        });
      }
    }
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(async (api) => {
    api.post('/auth/login', async (request, reply) => {
      const body = request.body as { username?: string; password?: string };
      const username = body?.username?.trim();
      const password = body?.password ?? '';

      if (!username || !password) {
        return reply.status(400).send({ statusCode: 400, message: 'Username and password are required' });
      }

      const operator = findOperatorByUsername(username);
      if (!operator) {
        logSecurityEvent(request.log, {
          type: 'auth_failure',
          username,
          ip: request.ip,
          details: 'User not found'
        });
        return reply.status(401).send({ statusCode: 401, message: 'Invalid credentials' });
      }

      // Get password hash from database (not exposed in OperatorProfile)
      const { sqlite } = await import('./db/client.js');
      const userRow = sqlite.prepare(`
        SELECT password_hash, must_reset_password FROM user WHERE id = ? LIMIT 1
      `).get(operator.id) as { password_hash: string; must_reset_password: number } | undefined;

      if (!userRow || !userRow.password_hash) {
        logSecurityEvent(request.log, {
          type: 'auth_failure',
          username,
          userId: operator.id,
          ip: request.ip,
          details: 'No password set'
        });
        return reply.status(401).send({ statusCode: 401, message: 'Invalid credentials' });
      }

      const valid = await argon2.verify(userRow.password_hash, password);
      if (!valid) {
        logSecurityEvent(request.log, {
          type: 'auth_failure',
          username,
          userId: operator.id,
          ip: request.ip,
          details: 'Invalid password'
        });
        return reply.status(401).send({ statusCode: 401, message: 'Invalid credentials' });
      }

      const now = new Date().toISOString();
      updateOperatorLoginTimestamp(operator.id, now);

      const response = issueToken(operator.id);
      response.mustResetPassword = Boolean(userRow.must_reset_password);
      return response;
    });

    api.get('/auth/session', async (request, reply) => {
      const authHeader = request.headers['authorization'];
      if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ statusCode: 401, message: 'Missing Authorization header' });
      }
      const token = authHeader.split(' ')[1] ?? '';
      const user = validateToken(token);
      if (!user) {
        return reply.status(401).send({ statusCode: 401, message: 'Session expired' });
      }
      return describeSession(token, user);
    });

    api.get('/dashboard', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      return getDashboard();
    });

    api.get('/admin/users', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_users', request.log, auth.user.id)) return;
      return listOperatorSummaries();
    });

    api.post('/admin/users', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_users', request.log, auth.user.id)) return;
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      if (parsed.data.role === 'admin' && auth.user.role !== 'admin') {
        return reply.status(403).send({ statusCode: 403, message: 'Only admins can assign the admin role' });
      }
      try {
        const created = await createOperatorAccount(parsed.data);
        request.log.info({ userId: auth.user.id, newUserId: created.id }, 'Operator account created');
        return created;
      } catch (error) {
        logError(request.log, error, {
          operation: 'createOperatorAccount',
          userId: auth.user.id,
          requestId: request.id,
          username: parsed.data.username
        });
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.patch('/admin/users/:id', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_users', request.log, auth.user.id)) return;
      const { id } = request.params as { id: string };
      const parsed = updateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      if (parsed.data.role === 'admin' && auth.user.role !== 'admin') {
        return reply.status(403).send({ statusCode: 403, message: 'Only admins can assign the admin role' });
      }
      try {
        const updated = await updateOperatorAccount(id, parsed.data);
        request.log.info({ userId: auth.user.id, targetUserId: id }, 'Operator account updated');
        return updated;
      } catch (error) {
        logError(request.log, error, {
          operation: 'updateOperatorAccount',
          userId: auth.user.id,
          targetUserId: id,
          requestId: request.id
        });
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.delete('/admin/users/:id', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_users', request.log, auth.user.id)) return;
      const { id } = request.params as { id: string };
      try {
        deleteOperatorAccount(id);
        request.log.info({ userId: auth.user.id, targetUserId: id }, 'Operator account deleted');
        reply.status(204).send();
      } catch (error) {
        logError(request.log, error, {
          operation: 'deleteOperatorAccount',
          userId: auth.user.id,
          targetUserId: id,
          requestId: request.id
        });
        reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.post('/admin/users/:id/reset-password', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_users', request.log, auth.user.id)) return;
      const { id } = request.params as { id: string };
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const summary = await resetOperatorPassword(id, parsed.data);
        request.log.info({ userId: auth.user.id, targetUserId: id }, 'Password reset completed');
        return summary;
      } catch (error) {
        logError(request.log, error, {
          operation: 'resetOperatorPassword',
          userId: auth.user.id,
          targetUserId: id,
          requestId: request.id
        });
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.post('/users/me/password', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      const parsed = changePasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        await changeOwnPassword(auth.user.id, parsed.data);
        request.log.info({ userId: auth.user.id }, 'User changed own password');
        reply.send({ status: 'ok' });
      } catch (error) {
        logError(request.log, error, {
          operation: 'changeOwnPassword',
          userId: auth.user.id,
          requestId: request.id
        });
        reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.patch('/users/me', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      const parsed = updateOwnProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const profile = updateOwnProfile(auth.user.id, parsed.data);
        request.log.info({ userId: auth.user.id }, 'User updated own profile');
        return profile;
      } catch (error) {
        logError(request.log, error, {
          operation: 'updateOwnProfile',
          userId: auth.user.id,
          requestId: request.id
        });
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/admin/games', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_games', request.log, auth.user.id)) return;
      return listGameDetails();
    });

    api.get('/admin/games/:id', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_games', request.log, auth.user.id)) return;
      const { id } = request.params as { id: string };
      const game = getGameDetails(id);
      if (!game) {
        return reply.status(404).send({ statusCode: 404, message: 'Game not found' });
      }
      return game;
    });

    api.post('/admin/games', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_games', request.log, auth.user.id)) return;
      const parsed = saveGameSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      const data = parsed.data;
      const payload: SaveGameRequest = {
        slug: data.slug,
        name: data.name,
        description: data.description,
        storyIntro: data.storyIntro,
        durationMinutes: data.durationMinutes,
        difficulty: data.difficulty,
        pricingModel: data.pricingModel,
        categories: data.categories ?? [],
        minPlayers: data.minPlayers,
        maxPlayers: data.maxPlayers,
        pricePerPlayerCents: data.pricePerPlayerCents,
        resourcesRequired: data.resourcesRequired,
        validationNotes: data.validationNotes,
        puzzles: (data.puzzles ?? []).map((puzzle, index) => ({ ...puzzle, id: puzzle.id ?? '', displayOrder: puzzle.displayOrder ?? index + 1 })),
        rooms: (data.rooms ?? []).map((room) => ({ ...room, id: room.id ?? '' }))
      };
      try {
        const created = createGame(payload);
        request.log.info({ userId: auth.user.id, gameId: created.id, slug: created.slug }, 'Game created');
        return created;
      } catch (error) {
        logError(request.log, error, {
          operation: 'createGame',
          userId: auth.user.id,
          requestId: request.id,
          gameSlug: payload.slug
        });
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.put('/admin/games/:id', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_games', request.log, auth.user.id)) return;
      const { id } = request.params as { id: string };
      const parsed = saveGameSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      const data = parsed.data;
      const payload: SaveGameRequest = {
        slug: data.slug,
        name: data.name,
        description: data.description,
        storyIntro: data.storyIntro,
        durationMinutes: data.durationMinutes,
        difficulty: data.difficulty,
        pricingModel: data.pricingModel,
        categories: data.categories ?? [],
        minPlayers: data.minPlayers,
        maxPlayers: data.maxPlayers,
        pricePerPlayerCents: data.pricePerPlayerCents,
        resourcesRequired: data.resourcesRequired,
        validationNotes: data.validationNotes,
        puzzles: (data.puzzles ?? []).map((puzzle, index) => ({ ...puzzle, id: puzzle.id ?? '', displayOrder: puzzle.displayOrder ?? index + 1 })),
        rooms: (data.rooms ?? []).map((room) => ({ ...room, id: room.id ?? '' }))
      };
      try {
        const updated = updateGame(id, payload);
        request.log.info({ userId: auth.user.id, gameId: id, slug: updated.slug }, 'Game updated');
        return updated;
      } catch (error) {
        logError(request.log, error, {
          operation: 'updateGame',
          userId: auth.user.id,
          requestId: request.id,
          gameId: id
        });
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.delete('/admin/games/:id', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_games', request.log, auth.user.id)) return;
      const { id } = request.params as { id: string };
      try {
        deleteGame(id);
        request.log.info({ userId: auth.user.id, gameId: id }, 'Game deleted');
        reply.status(204).send();
      } catch (error) {
        logError(request.log, error, {
          operation: 'deleteGame',
          userId: auth.user.id,
          requestId: request.id,
          gameId: id
        });
        reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/admin/network', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'view_network', request.log, auth.user.id)) return;
      return getNetworkProfile();
    });

    api.post('/admin/network/apply', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_network', request.log, auth.user.id)) return;
      const parsed = networkProvisionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const result = await applyEscapePlanConfig(parsed.data as ApplyNetworkConfigRequest);
        request.log.info({ userId: auth.user.id, ssid: parsed.data.wifi?.ssid }, 'Network configuration applied');
        emitDashboardUpdate(getDashboard());
        return result as ApplyNetworkConfigResponse;
      } catch (error) {
        logError(request.log, error, {
          operation: 'applyNetworkConfiguration',
          userId: auth.user.id,
          requestId: request.id
        });
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.patch('/admin/network', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_network', request.log, auth.user.id)) return;
      const parsed = networkUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const updated = updateNetworkProfile(parsed.data);
        request.log.info({ userId: auth.user.id }, 'Network profile updated');
        emitDashboardUpdate(getDashboard());
        return updated;
      } catch (error) {
        logError(request.log, error, {
          operation: 'updateNetworkProfile',
          userId: auth.user.id,
          requestId: request.id
        });
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/admin/settings', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_system_health', request.log, auth.user.id)) return;
      try {
        const allSettings = await settings.getAll();
        return { settings: allSettings };
      } catch (error) {
        logError(request.log, error, {
          operation: 'getSettings',
          userId: auth.user.id,
          requestId: request.id
        });
        return reply.status(500).send({ statusCode: 500, message: 'Failed to load settings' });
      }
    });

    api.get('/admin/system/health', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      try {
        const io = (app.server as any).io;
        const health = await getCurrentSystemHealth(io);
        return health;
      } catch (error) {
        logError(request.log, error, {
          operation: 'getSystemHealth',
          userId: auth.user.id,
          requestId: request.id
        });
        return reply.status(500).send({ statusCode: 500, message: 'Failed to load system health' });
      }
    });

    api.get('/admin/roles', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'view_roles', request.log, auth.user.id)) return;
      return { roles: listRoles() };
    });

    api.get('/admin/permissions', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'view_permissions', request.log, auth.user.id)) return;
      return { permissions: listPermissions() };
    });

    api.get('/admin/cameras', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'view_cameras', request.log, auth.user.id)) return;
      // TODO: Implement camera management state
      return { cameras: [] };
    });

    api.get('/sessions', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      const { status = 'active' } = request.query as { status?: 'active' | 'all' };
      if (status === 'active') {
        return { sessions: listActiveSessions() };
      }
      return { sessions: listSessions() };
    });

    api.post('/sessions/quick-start', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_sessions', request.log, auth.user.id)) return;

      const body = request.body as { gameSlug: string; bookingId?: string };
      if (!body?.gameSlug) {
        return reply.status(400).send({ statusCode: 400, message: 'gameSlug is required' });
      }

      try {
        const session = quickStartSession({ gameSlug: body.gameSlug, bookingId: body.bookingId }, auth.user.id);
        emitSessionUpdate();
        emitTimerUpdate();
        return session;
      } catch (error) {
        logError(request.log, error, {
          operation: 'quickStartSession',
          userId: auth.user.id,
          gameSlug: body.gameSlug,
          requestId: request.id
        });
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/admin/network/client', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'view_network', request.log, auth.user.id)) return;
      // TODO: Implement WiFi client status
      return {
        status: 'disconnected',
        ssid: null,
        signalStrength: null,
        ipAddress: null
      };
    });

    api.get('/assets/list', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'view_assets', request.log, auth.user.id)) return;
      // TODO: Implement asset management
      return { assets: [], totalSize: 0, count: 0 };
    });

    api.get('/admin/backups', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'view_storage', request.log, auth.user.id)) return;
      const { destination = 'local' } = request.query as { destination?: 'local' | 'external' };
      // TODO: Implement backup management
      return { backups: [], destination };
    });

    api.get('/bookings', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;

      const { date, scope = 'all' } = request.query as { date?: string; scope?: 'all' | 'storefront' | 'mobile' };
      if (!date) {
        return reply.status(400).send({ statusCode: 400, message: 'date query parameter required (YYYY-MM-DD)' });
      }

      return getBookingsByDate(date, scope);
    });

    api.get('/sessions/active', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;
      return listActiveSessions();
    });

    api.get('/sessions/:sessionId', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;

      const { sessionId } = request.params as { sessionId: string };
      const sessionRecord = getSessionById(sessionId);
      if (!sessionRecord) {
        return reply.status(404).send({ statusCode: 404, message: 'Session not found' });
      }
      return sessionRecord;
    });

    api.post('/sessions/:sessionId/commands', async (request, reply) => {
      const auth = await ensureAuth(request, reply);
      if (!auth) return;

      const { sessionId } = request.params as { sessionId: string };
      const command = request.body as CommandRequest;
      if (!command?.command) {
        return reply.status(400).send({ statusCode: 400, message: 'Command payload required' });
      }

      try {
        const result = applyCommand(sessionId, command);
        request.log.info({ userId: auth.user.id, sessionId, command: command.command }, 'Session command applied');
        return result;
      } catch (error) {
        logError(request.log, error, {
          operation: 'applySessionCommand',
          userId: auth.user.id,
          requestId: request.id,
          sessionId,
          command: command.command
        });
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/public/timer/:slug', async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const sessionRecord = getSessionBySlug(slug);
      if (!sessionRecord) {
        return reply.status(404).send({ statusCode: 404, message: 'Timer not found' });
      }
      return toTimerBroadcast(sessionRecord.slug, sessionRecord.session, sessionRecord.narrative);
    });

  }, { prefix: '/api' });

  const io = new SocketServer(app.server, {
    cors: { origin: true }
  });

  attachRealtime(io);

  io.use(async (socket, next) => {
    try {
      // First try Better Auth session from cookies
      const cookies = socket.handshake.headers.cookie;
      if (cookies) {
        const session = await auth.api.getSession({
          headers: { cookie: cookies } as any
        });
        if (session?.user) {
          socket.data.user = {
            id: session.user.id,
            username: (session.user as any).username,
            role: (session.user as any).role,
            permissions: (session.user as any).permissions || []
          };
          return next();
        }
      }

      // Fallback to Bearer token
      const token = (socket.handshake.auth?.token ?? socket.handshake.query?.token) as string | undefined;
      if (!token) {
        return next(new Error('Unauthorized'));
      }
      const user = validateToken(token);
      if (!user) {
        return next(new Error('Unauthorized'));
      }
      socket.data.user = user;
      next();
    } catch (error) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.emit('dashboard:update', getDashboard());
    socket.emit('session:update:init', listActiveSessions().sessions);
  });

  // Attach Socket.IO instance to the server for graceful shutdown
  (app.server as any).io = io;

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const server = await buildServer();
  try {
    await server.listen({ port: DEFAULT_PORT, host: '0.0.0.0' });
    server.log.info(`EscapePlan API listening on http://localhost:${DEFAULT_PORT}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    server.log.info(`${signal} received, starting graceful shutdown`);

    try {
      // Get the Socket.IO instance from the server
      const io = (server.server as any).io;

      // Close Socket.IO connections first
      if (io) {
        server.log.info('Closing Socket.IO connections...');
        await new Promise<void>((resolve) => {
          io.close(() => {
            server.log.info('Socket.IO closed');
            resolve();
          });
        });

        // Wait 2 seconds for Socket.IO to fully close
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Then close Fastify server
      server.log.info('Closing Fastify server...');
      await server.close();
      server.log.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      server.log.error({ err: error }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
