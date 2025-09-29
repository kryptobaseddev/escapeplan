import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import argon2 from 'argon2';
import { z } from 'zod';
import type { CommandRequest, OperatorPermission, OperatorRole, SaveGameRequest } from '@escapeplan/contracts';
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
  listOperatorSummaries,
  rotateAdminCredentials,
  toTimerBroadcast,
  updateGame,
  updateNetworkProfile,
  updateOperatorAccount,
  updateOwnProfile,
  updateOperatorLoginTimestamp,
  resetOperatorPassword
} from './state.js';
import { describeSession, issueToken, validateToken } from './auth.js';
import { runMigrations } from './db/client.js';
import { attachRealtime, emitAuthRotation, emitDashboardUpdate, emitSessionUpdate, emitTimerUpdate } from './realtime.js';

const DEFAULT_PORT = Number(process.env.PORT ?? 4000);

const operatorRoleValues = ['admin', 'general_manager', 'game_master', 'technician'] as const;

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

function ensureAuth(request: FastifyRequest, reply: FastifyReply) {
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

function ensurePermission(reply: FastifyReply, userRole: OperatorRole, userPermissions: OperatorPermission[], permission: OperatorPermission) {
  if (userRole === 'admin' || userPermissions.includes(permission)) {
    return true;
  }
  reply.status(403).send({ statusCode: 403, message: 'Permission denied' });
  return false;
}

export async function buildServer() {
  runMigrations();
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

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
        return reply.status(401).send({ statusCode: 401, message: 'Invalid credentials' });
      }
      const valid = await argon2.verify(operator.passwordHash, password);
      if (!valid) {
        return reply.status(401).send({ statusCode: 401, message: 'Invalid credentials' });
      }

      const now = new Date().toISOString();
      updateOperatorLoginTimestamp(operator.id, now);

      const response = issueToken(operator.id);
      response.mustResetPassword = operator.mustResetPassword;
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
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      return getDashboard();
    });

    api.get('/admin/users', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_users')) return;
      return listOperatorSummaries();
    });

    api.post('/admin/users', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_users')) return;
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const created = await createOperatorAccount(parsed.data);
        return created;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create operator');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.patch('/admin/users/:id', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_users')) return;
      const { id } = request.params as { id: string };
      const parsed = updateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const updated = await updateOperatorAccount(id, parsed.data);
        return updated;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update operator');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.delete('/admin/users/:id', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_users')) return;
      const { id } = request.params as { id: string };
      try {
        deleteOperatorAccount(id);
        reply.status(204).send();
      } catch (error) {
        request.log.error({ err: error }, 'Failed to delete operator');
        reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.post('/admin/users/:id/reset-password', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_users')) return;
      const { id } = request.params as { id: string };
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const summary = await resetOperatorPassword(id, parsed.data);
        return summary;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to reset password');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.post('/users/me/password', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      const parsed = changePasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        await changeOwnPassword(auth.user.id, parsed.data);
        reply.send({ status: 'ok' });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update password');
        reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.patch('/users/me', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      const parsed = updateOwnProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const profile = updateOwnProfile(auth.user.id, parsed.data);
        return profile;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update profile');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/admin/games', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_games')) return;
      return listGameDetails();
    });

    api.get('/admin/games/:id', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_games')) return;
      const { id } = request.params as { id: string };
      const game = getGameDetails(id);
      if (!game) {
        return reply.status(404).send({ statusCode: 404, message: 'Game not found' });
      }
      return game;
    });

    api.post('/admin/games', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_games')) return;
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
        return created;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create game');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.put('/admin/games/:id', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_games')) return;
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
        return updated;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update game');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.delete('/admin/games/:id', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_games')) return;
      const { id } = request.params as { id: string };
      try {
        deleteGame(id);
        reply.status(204).send();
      } catch (error) {
        request.log.error({ err: error }, 'Failed to delete game');
        reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/admin/network', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'view_network')) return;
      return getNetworkProfile();
    });

    api.patch('/admin/network', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'manage_network')) return;
      const parsed = networkUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const updated = updateNetworkProfile(parsed.data);
        emitDashboardUpdate(getDashboard());
        return updated;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update network profile');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/bookings', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;

      const { date, scope = 'all' } = request.query as { date?: string; scope?: 'all' | 'storefront' | 'mobile' };
      if (!date) {
        return reply.status(400).send({ statusCode: 400, message: 'date query parameter required (YYYY-MM-DD)' });
      }

      return getBookingsByDate(date, scope);
    });

    api.get('/sessions/active', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      return listActiveSessions();
    });

    api.get('/sessions/:sessionId', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;

      const { sessionId } = request.params as { sessionId: string };
      const sessionRecord = getSessionById(sessionId);
      if (!sessionRecord) {
        return reply.status(404).send({ statusCode: 404, message: 'Session not found' });
      }
      return sessionRecord;
    });

    api.post('/sessions/:sessionId/commands', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;

      const { sessionId } = request.params as { sessionId: string };
      const command = request.body as CommandRequest;
      if (!command?.command) {
        return reply.status(400).send({ statusCode: 400, message: 'Command payload required' });
      }

      try {
        const result = applyCommand(sessionId, command);
        return result;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to apply command');
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

    api.post('/admin/rotate-credentials', async (request, reply) => {
      const auth = ensureAuth(request, reply);
      if (!auth) return;
      if (!ensurePermission(reply, auth.user.role, auth.user.permissions, 'rotate_admin_credentials')) return;
      const credentials = rotateAdminCredentials();
      emitAuthRotation();
      return credentials;
    });
  }, { prefix: '/api' });

  const io = new SocketServer(app.server, {
    cors: { origin: true }
  });

  attachRealtime(io);

  io.use((socket, next) => {
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
  });

  io.on('connection', (socket) => {
    socket.emit('dashboard:update', getDashboard());
    socket.emit('session:update:init', listActiveSessions().sessions);
  });

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
}
