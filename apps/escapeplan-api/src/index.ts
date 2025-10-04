import path from 'node:path';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { Server as SocketServer } from 'socket.io';
import { z } from 'zod';
import type {
  CommandRequest,
  OperatorPermission,
  OperatorRole,
  SaveGameRequest,
  ApplyNetworkConfigRequest,
  ApplyNetworkConfigResponse,
  CreateOperatorRequest,
  UpdateOperatorRequest,
  QuickStartSessionRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  CreateCameraRequest,
  UpdateCameraRequest
} from '@escapeplan/contracts';
import {
  saveGameSchema,
  createOperatorSchema,
  updateOperatorSchema,
  quickStartSchema,
  sessionCommandSchema,
  createRoleSchema,
  updateRoleSchema,
  createCameraSchema,
  updateCameraSchema
} from '@escapeplan/contracts';
import {
  applyCommand,
  changeOwnPassword,
  createGame,
  createOperatorAccount,
  deleteGame,
  deleteOperatorAccount,
  getGameDetails,
  archiveGame,
  unarchiveGame,
  getBookingsByDate,
  getDashboard,
  getSessionById,
  getSessionBySlug,
  getNetworkProfile,
  listGameDetails,
  listActiveSessions,
  listSessions,
  quickStartSession,
  listOperatorSummaries,
  toTimerBroadcast,
  updateGame,
  updateNetworkProfile,
  updateOperatorAccount,
  updateOwnProfile,
  resetOperatorPassword,
  archiveOperatorAccount,
  unarchiveOperatorAccount,
  scanWiFiNetworks,
  connectToWiFi,
  getWiFiClientStatus,
  disconnectFromWiFi,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  updateRolePermissions,
  deleteRole,
  listPermissions,
  getPermissionMatrix
} from './state.js';
import { initializeSettings, settings } from './settings.js';
import { seedSystemSettings } from './db/seed-settings.js';
import { auth, requireSession } from './auth.js';
import { db, sqlite } from './db/client.js';
import { operators, alertRules, systemLogs, cameras, games } from '@escapeplan/contracts';
import { eq, and, like, count, desc } from 'drizzle-orm';
import { attachRealtime, emitDashboardUpdate, emitSessionUpdate } from './realtime.js';
import { applyEscapePlanConfig } from './platform.js';
import { handleAssetUpload, getStorageMetrics, deleteAsset, listAssets, linkReusableAsset, getAssetById } from './assets/upload.js';
import { logToDatabase, dismissAlert } from './logging/index.js';
import { setupUpdateRoutes } from './updates.js';

const DEFAULT_PORT = Number(process.env.PORT ?? 4000);

const operatorRoleValues = ['admin', 'manager', 'game_master', 'customer'] as const;

const operatorRoleFilterValues = [...operatorRoleValues, 'all'] as const;
const userStatusFilterValues = ['active', 'archived', 'all'] as const;

const resetPasswordSchema = z.object({
  password: z.string().min(12),
  forceReset: z.boolean().optional()
});

const archiveUserSchema = z.object({
  reason: z.string().max(500).optional().nullable()
});

const archiveGameSchema = z.object({
  reason: z.string().max(500).optional().nullable()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(12)
});

const avatarConfigSchema = z.object({
  seed: z.string(),
  backgroundType: z.array(z.string()).optional(),
  backgroundColor: z.array(z.string()).optional(),
  baseColor: z.array(z.string()).optional(),
  eyes: z.array(z.string()).optional(),
  face: z.array(z.string()).optional(),
  mouth: z.array(z.string()).optional(),
  sides: z.array(z.string()).optional(),
  texture: z.array(z.string()).optional(),
  top: z.array(z.string()).optional()
});

const updateOwnProfileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal(null)),
  avatarConfig: avatarConfigSchema.optional().or(z.literal(null)),
  bio: z.string().max(500).optional().or(z.literal(null))
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

const listUsersQuerySchema = z
  .object({
    search: z.string().optional(),
    role: z.enum(operatorRoleFilterValues).optional(),
    status: z.enum(userStatusFilterValues).optional()
  })
  .partial();

async function ensureAuth(request: FastifyRequest, reply: FastifyReply) {
  const session = await requireSession(request.headers);
  if (!session) {
    reply.status(401).send({ statusCode: 401, message: 'Authentication required' });
    return null;
  }
  if (session.user && typeof (session.user as Record<string, unknown>).archivedAt === 'string') {
    reply.status(403).send({ statusCode: 403, message: 'Account is archived' });
    return null;
  }
  return session;
}

function ensurePermission(reply: FastifyReply, userRole: OperatorRole, userPermissions: OperatorPermission[], permission: OperatorPermission) {
  if (userRole === 'admin' || userPermissions.includes(permission)) {
    return true;
  }
  reply.status(403).send({ statusCode: 403, message: 'Permission denied' });
  return false;
}

export async function buildServer() {
  const app = Fastify({ logger: true });

  const webOrigin = process.env.WEB_APP_ORIGIN ?? 'http://localhost:5173';

  await app.register(cors, {
    origin: webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1024 * 1024,  // 1MB
      fields: 10,
      fileSize: 50 * 1024 * 1024,  // 50MB max file size
      files: 1,
      headerPairs: 2000
    }
  });

  // Register static file serving for assets
  const assetBasePath = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production'
    ? path.join(process.cwd(), 'data', 'assets')
    : '/var/lib/escapeplan/assets';

  await app.register(fastifyStatic, {
    root: assetBasePath,
    prefix: '/assets/',
    decorateReply: false
  });

  app.get('/health', async () => ({ status: 'ok' }));

  // Setup update routes
  setupUpdateRoutes(app);

  await app.register(async (api) => {
    api.all('/auth/*', async (request, reply) => {
      try {
        // Block archived users from signing in
        if (request.url.includes('/sign-in') && request.method === 'POST') {
          const body = request.body as Record<string, unknown> | undefined;
          const username = typeof body?.username === 'string' ? body.username : null;

          if (username) {
            const [user] = await db.select().from(operators).where(eq(operators.username, username.trim().toLowerCase())).limit(1);
            if (user?.archived_at) {
              return reply.status(403).send({
                error: {
                  code: 'ACCOUNT_ARCHIVED',
                  message: 'This account has been archived and cannot sign in'
                }
              });
            }
          }
        }

        const origin = `${request.protocol}://${request.headers.host}`;
        const url = new URL(request.url, origin);

        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (!value) continue;
          if (Array.isArray(value)) {
            value.forEach((item) => headers.append(key, item));
          } else {
            headers.append(key, String(value));
          }
        }

        let body: BodyInit | undefined;
        if (request.method !== 'GET' && request.body !== undefined) {
          if (Buffer.isBuffer(request.body)) {
            body = request.body as unknown as BodyInit;
          } else if (typeof request.body === 'string') {
            body = request.body;
          } else if (typeof request.body === 'object') {
            body = JSON.stringify(request.body);
            if (!headers.has('content-type')) {
              headers.set('content-type', 'application/json');
            }
          }
        }

        const webRequest = new Request(url.toString(), {
          method: request.method,
          headers,
          body
        });

        const response = await auth.handler(webRequest);

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });

        if (response.body) {
          const arrayBuffer = await response.arrayBuffer();
          reply.send(Buffer.from(arrayBuffer));
        } else {
          reply.send();
        }
      } catch (error) {
        request.log.error({ err: error }, 'Authentication handler error');
        reply.status(500).send({ error: 'Internal authentication error', code: 'AUTH_FAILURE' });
      }
    });

    api.get('/dashboard', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      return getDashboard();
    });

    api.get('/admin/users', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_users')) return;
      const parsed = listUsersQuerySchema.safeParse(request.query ?? {});
      const filters = parsed.success
        ? {
            search: parsed.data.search,
            role: parsed.data.role ?? ('all' as const),
            status: parsed.data.status ?? ('active' as const)
          }
        : { role: 'all' as const, status: 'active' as const };
      return listOperatorSummaries(filters);
    });

    api.post('/admin/users', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_users')) return;
      const parsed = createOperatorSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      if (parsed.data.role === 'admin' && session.user.role !== 'admin') {
        return reply.status(403).send({ statusCode: 403, message: 'Only admins can assign the admin role' });
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
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_users')) return;
      const { id } = request.params as { id: string };
      const parsed = updateOperatorSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      if (parsed.data.role === 'admin' && session.user.role !== 'admin') {
        return reply.status(403).send({ statusCode: 403, message: 'Only admins can assign the admin role' });
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
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_users')) return;
      const { id } = request.params as { id: string };
      try {
        await deleteOperatorAccount(id);
        reply.status(204).send();
      } catch (error) {
        request.log.error({ err: error }, 'Failed to delete operator');
        reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.patch('/admin/users/:id/archive', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_users')) return;
      const { id } = request.params as { id: string };
      const parsed = archiveUserSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const archived = await archiveOperatorAccount(id, session.user.id as string, parsed.data.reason ?? null);
        return archived;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to archive operator');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.patch('/admin/users/:id/unarchive', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_users')) return;
      const { id } = request.params as { id: string };
      try {
        const restored = await unarchiveOperatorAccount(id);
        return restored;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to unarchive operator');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.post('/admin/users/:id/reset-password', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_users')) return;
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

    // ========================================================================
    // ROLES & PERMISSIONS MANAGEMENT
    // ========================================================================

    api.get('/admin/roles', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_roles')) return;
      return listRoles();
    });

    api.post('/admin/roles', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_roles')) return;

      const parsed = createRoleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      try {
        const created = createRole(parsed.data);
        return created;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create role');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/admin/roles/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_roles')) return;

      const { id } = request.params as { id: string };
      const role = getRoleById(id);
      if (!role) {
        return reply.status(404).send({ statusCode: 404, message: 'Role not found' });
      }
      return role;
    });

    api.patch('/admin/roles/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_roles')) return;

      const { id } = request.params as { id: string };
      const parsed = updateRoleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      try {
        const updated = updateRole(id, parsed.data);
        return updated;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update role');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.delete('/admin/roles/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_roles')) return;

      const { id } = request.params as { id: string };
      try {
        deleteRole(id);
        reply.status(204).send();
      } catch (error) {
        request.log.error({ err: error }, 'Failed to delete role');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.patch('/admin/roles/:id/permissions', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_permissions')) return;

      const updatePermissionsSchema = z.object({
        permissionIds: z.array(z.string())
      });

      const { id } = request.params as { id: string };
      const parsed = updatePermissionsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      try {
        const updated = updateRolePermissions(id, parsed.data, session.user.id);
        return updated;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update role permissions');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/admin/permissions', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_permissions')) return;
      return listPermissions();
    });

    api.get('/admin/permissions/matrix', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_permissions')) return;
      return getPermissionMatrix();
    });

    api.post('/users/me/password', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      const parsed = changePasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        await changeOwnPassword(session.user.id, parsed.data);
        reply.status(204).send();
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update password');
        reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.patch('/users/me', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      const parsed = updateOwnProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const profile = await updateOwnProfile(session.user.id, parsed.data);
        return profile;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update profile');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/admin/games', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_games')) return;
      const query = request.query as {
        search?: string;
        status?: 'active' | 'archived' | 'all';
        category?: string;
      };

      const filters = {
        search: query?.search?.trim() || undefined,
        status: query?.status,
        category: query?.category?.trim() || undefined
      };

      return listGameDetails(filters);
    });

    api.get('/admin/games/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_games')) return;
      const { id } = request.params as { id: string };
      const game = getGameDetails(id);
      if (!game) {
        return reply.status(404).send({ statusCode: 404, message: 'Game not found' });
      }
      return game;
    });

    api.post('/admin/games', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_games')) return;
      const parsed = saveGameSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      // Validate duration against system settings
      const minDuration = settings.getGameDurationMinMinutes();
      const maxDuration = settings.getGameDurationMaxMinutes();
      if (parsed.data.durationMinutes < minDuration || parsed.data.durationMinutes > maxDuration) {
        return reply.status(400).send({
          statusCode: 400,
          message: `Duration must be between ${minDuration} and ${maxDuration} minutes`,
          details: { durationMinutes: `Must be between ${minDuration} and ${maxDuration}` }
        });
      }

      try {
        const created = createGame(parsed.data);
        return created;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create game');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.put('/admin/games/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_games')) return;
      const { id } = request.params as { id: string };
      const parsed = saveGameSchema.safeParse(request.body);
      if (!parsed.success) {
        request.log.error({ validation: parsed.error.flatten() }, 'Game validation failed');
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      // Validate duration against system settings
      const minDuration = settings.getGameDurationMinMinutes();
      const maxDuration = settings.getGameDurationMaxMinutes();
      if (parsed.data.durationMinutes < minDuration || parsed.data.durationMinutes > maxDuration) {
        return reply.status(400).send({
          statusCode: 400,
          message: `Duration must be between ${minDuration} and ${maxDuration} minutes`,
          details: { durationMinutes: `Must be between ${minDuration} and ${maxDuration}` }
        });
      }

      try {
        const updated = updateGame(id, parsed.data);
        return updated;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update game');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.patch('/admin/games/:id/archive', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_games')) return;
      const { id } = request.params as { id: string };
      const parsed = archiveGameSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const archived = archiveGame(id, session.user.id as string, parsed.data.reason ?? null);
        return archived;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to archive game');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.patch('/admin/games/:id/unarchive', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_games')) return;
      const { id } = request.params as { id: string };
      try {
        const restored = unarchiveGame(id);
        return restored;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to unarchive game');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.delete('/admin/games/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_games')) return;
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
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_network')) return;
      return getNetworkProfile();
    });

    api.post('/admin/network/apply', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_network')) return;
      const parsed = networkProvisionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const result = await applyEscapePlanConfig(parsed.data as ApplyNetworkConfigRequest);
        emitDashboardUpdate(getDashboard());
        return result as ApplyNetworkConfigResponse;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to apply network configuration');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.patch('/admin/network', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_network')) return;
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

    // WiFi Client Management Routes
    api.get('/admin/network/scan', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_network')) return;

      try {
        return scanWiFiNetworks();
      } catch (error) {
        request.log.error({ err: error }, 'WiFi scan failed');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.get('/admin/network/client', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_network')) return;

      try {
        return getWiFiClientStatus();
      } catch (error) {
        request.log.error({ err: error }, 'Failed to get WiFi client status');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.post('/admin/network/client', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_network')) return;

      const schema = z.object({
        ssid: z.string(),
        password: z.string().optional(),
        security: z.string().optional()
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      try {
        return connectToWiFi(parsed.data);
      } catch (error) {
        request.log.error({ err: error }, 'WiFi connection failed');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.delete('/admin/network/client', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_network')) return;

      try {
        return disconnectFromWiFi();
      } catch (error) {
        request.log.error({ err: error }, 'WiFi disconnection failed');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    // =========================================================================
    // Camera Management Routes
    // =========================================================================

    // Get all cameras
    api.get('/admin/cameras', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_cameras')) return;

      const camerasWithGames = db.select({
        id: cameras.id,
        name: cameras.name,
        gameId: cameras.game_id,
        gameName: games.name,
        protocol: cameras.protocol,
        host: cameras.host,
        port: cameras.port,
        status: cameras.status,
        lastSeen: cameras.last_seen,
        hlsStreaming: cameras.hls_streaming,
      })
        .from(cameras)
        .leftJoin(games, eq(cameras.game_id, games.id))
        .all();

      return { cameras: camerasWithGames };
    });

    // Create camera
    api.post('/admin/cameras', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_cameras')) return;

      const parsed = createCameraSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      const { encryptPassword } = await import('./cameras/encryption.js');
      const { nanoid } = await import('nanoid');

      const passwordEncrypted = parsed.data.password ? encryptPassword(parsed.data.password) : null;

      try {
        // If gameId provided, verify game exists
        if (parsed.data.gameId) {
          const game = db.select().from(games).where(eq(games.id, parsed.data.gameId)).get();
          if (!game) {
            return reply.status(404).send({ statusCode: 404, message: 'Game not found' });
          }
        }

        const cameraId = nanoid();

        // Create camera
        db.insert(cameras).values({
          id: cameraId,
          name: parsed.data.name,
          game_id: parsed.data.gameId || null,
          protocol: parsed.data.protocol,
          host: parsed.data.host,
          port: parsed.data.port,
          username: parsed.data.username || null,
          password_encrypted: passwordEncrypted,
          stream_path: parsed.data.streamPath || null,
          resolution: parsed.data.resolution,
          frame_rate: parsed.data.frameRate,
          transport: parsed.data.transport,
          status: 'offline',
          hls_streaming: false,
        }).run();

        // If associated with game, update game's camera_ids array
        if (parsed.data.gameId) {
          const game = db.select().from(games).where(eq(games.id, parsed.data.gameId)).get();
          if (game) {
            const cameraIds = Array.isArray(game.camera_ids) ? game.camera_ids : [];
            if (!cameraIds.includes(cameraId)) {
              cameraIds.push(cameraId);
              db.update(games)
                .set({ camera_ids: cameraIds })
                .where(eq(games.id, parsed.data.gameId))
                .run();
            }
          }
        }

        const created = db.select().from(cameras).where(eq(cameras.id, cameraId)).get();
        return reply.status(201).send(created);
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create camera');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    // Update camera
    api.patch('/admin/cameras/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_cameras')) return;

      const { id } = request.params as { id: string };

      const parsed = updateCameraSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      try {
        const camera = db.select().from(cameras).where(eq(cameras.id, id)).get();
        if (!camera) {
          return reply.status(404).send({ statusCode: 404, message: 'Camera not found' });
        }

        const { encryptPassword } = await import('./cameras/encryption.js');

        const updates: any = {};
        if (parsed.data.name !== undefined) updates.name = parsed.data.name;
        if (parsed.data.protocol !== undefined) updates.protocol = parsed.data.protocol;
        if (parsed.data.host !== undefined) updates.host = parsed.data.host;
        if (parsed.data.port !== undefined) updates.port = parsed.data.port;
        if (parsed.data.username !== undefined) updates.username = parsed.data.username || null;
        if (parsed.data.password !== undefined) updates.password_encrypted = parsed.data.password ? encryptPassword(parsed.data.password) : null;
        if (parsed.data.streamPath !== undefined) updates.stream_path = parsed.data.streamPath || null;
        if (parsed.data.resolution !== undefined) updates.resolution = parsed.data.resolution;
        if (parsed.data.frameRate !== undefined) updates.frame_rate = parsed.data.frameRate;
        if (parsed.data.transport !== undefined) updates.transport = parsed.data.transport;

        // Handle game association change
        if (parsed.data.gameId !== undefined) {
          const oldGameId = camera.game_id;
          const newGameId = parsed.data.gameId;

          // Remove from old game's camera_ids
          if (oldGameId && oldGameId !== newGameId) {
            const oldGame = db.select().from(games).where(eq(games.id, oldGameId)).get();
            if (oldGame) {
              const cameraIds = Array.isArray(oldGame.camera_ids) ? oldGame.camera_ids.filter((cid: string) => cid !== id) : [];
              db.update(games)
                .set({ camera_ids: cameraIds })
                .where(eq(games.id, oldGameId))
                .run();
            }
          }

          // Add to new game's camera_ids
          if (newGameId && newGameId !== oldGameId) {
            const newGame = db.select().from(games).where(eq(games.id, newGameId)).get();
            if (!newGame) {
              return reply.status(404).send({ statusCode: 404, message: 'Game not found' });
            }
            const cameraIds = Array.isArray(newGame.camera_ids) ? newGame.camera_ids : [];
            if (!cameraIds.includes(id)) {
              cameraIds.push(id);
              db.update(games)
                .set({ camera_ids: cameraIds })
                .where(eq(games.id, newGameId))
                .run();
            }
          }

          updates.game_id = newGameId || null;
        }

        db.update(cameras)
          .set(updates)
          .where(eq(cameras.id, id))
          .run();

        const updated = db.select().from(cameras).where(eq(cameras.id, id)).get();
        return updated;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update camera');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    // Delete camera
    api.delete('/admin/cameras/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_cameras')) return;

      const { id } = request.params as { id: string };

      try {
        const camera = db.select().from(cameras).where(eq(cameras.id, id)).get();
        if (!camera) {
          return reply.status(404).send({ statusCode: 404, message: 'Camera not found' });
        }

        // Remove from game's camera_ids if associated
        if (camera.game_id) {
          const game = db.select().from(games).where(eq(games.id, camera.game_id)).get();
          if (game) {
            const cameraIds = Array.isArray(game.camera_ids) ? game.camera_ids.filter((cid: string) => cid !== id) : [];
            db.update(games)
              .set({ camera_ids: cameraIds })
              .where(eq(games.id, camera.game_id))
              .run();
          }
        }

        db.delete(cameras).where(eq(cameras.id, id)).run();

        return reply.status(204).send();
      } catch (error) {
        request.log.error({ err: error }, 'Failed to delete camera');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    // Test camera connection
    api.post('/admin/cameras/test-connection', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_cameras')) return;

      const schema = z.object({
        protocol: z.enum(['rtsp', 'mjpeg', 'onvif']),
        host: z.string().min(1),
        port: z.number().int().positive(),
        username: z.string().optional().nullable(),
        password: z.string().optional().nullable(),
        streamPath: z.string().optional().nullable(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      try {
        const { testCameraConnection } = await import('./cameras/connection.js');
        const result = await testCameraConnection(parsed.data);
        return result;
      } catch (error) {
        request.log.error({ err: error }, 'Camera connection test failed');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    // =========================================================================
    // Logging & Alerting System Routes
    // =========================================================================

    // Get all alert rules
    api.get('/admin/alert-rules', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_system_logs')) return;

      const rules = db.select()
        .from(alertRules)
        .orderBy(alertRules.category, alertRules.name)
        .all();
      return { rules };
    });

    // Update an alert rule
    api.patch('/admin/alert-rules/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_alert_rules')) return;

      const { id } = request.params as { id: string };
      const { enabled, level, conditions, title_template, message_template, auto_dismiss_on } = request.body as {
        enabled?: boolean;
        level?: string;
        conditions?: object;
        title_template?: string;
        message_template?: string;
        auto_dismiss_on?: string[] | null;
      };

      try {
        const updates: Partial<typeof alertRules.$inferInsert> = {};

        if (enabled !== undefined) {
          updates.enabled = enabled;
        }
        if (level !== undefined) {
          updates.level = level;
        }
        if (conditions !== undefined) {
          updates.conditions = conditions;
        }
        if (title_template !== undefined) {
          updates.title_template = title_template;
        }
        if (message_template !== undefined) {
          updates.message_template = message_template;
        }
        if (auto_dismiss_on !== undefined) {
          updates.auto_dismiss_on = auto_dismiss_on ?? null;
        }

        if (Object.keys(updates).length === 0) {
          return reply.status(400).send({ statusCode: 400, message: 'No fields to update' });
        }

        updates.updated_at = new Date().toISOString();

        db.update(alertRules)
          .set(updates)
          .where(eq(alertRules.id, id))
          .run();

        logToDatabase('info', 'system', `Alert rule updated: ${id}`, {
          ruleId: id,
          updatedBy: session.user.id
        });

        return { success: true };
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update alert rule');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    // Get system logs with filtering
    api.get('/admin/logs', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_system_logs')) return;

      try {
        const { level, category, limit = '100', offset = '0', search } = request.query as {
          level?: string;
          category?: string;
          limit?: string;
          offset?: string;
          search?: string;
        };

        // Build where conditions using Drizzle operators
        const conditions = [];
        if (level) {
          conditions.push(eq(systemLogs.level, level));
        }
        if (category) {
          conditions.push(eq(systemLogs.category, category));
        }
        if (search) {
          conditions.push(like(systemLogs.message, `%${search}%`));
        }

        // Query logs using Drizzle ORM
        const logs = db.select()
          .from(systemLogs)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(systemLogs.timestamp))
          .limit(parseInt(limit, 10))
          .offset(parseInt(offset, 10))
          .all();

        // Get total count
        const [totalResult] = db.select({ count: count() })
          .from(systemLogs)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .all();

        return { logs, total: totalResult.count };
      } catch (error) {
        request.log.error({ err: error }, 'Failed to query system logs');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    // Dismiss an alert
    api.post('/admin/alerts/:id/dismiss', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;

      const { id } = request.params as { id: string };

      try {
        dismissAlert(id, session.user.id as string);
        emitDashboardUpdate(getDashboard());
        return { success: true };
      } catch (error) {
        request.log.error({ err: error }, 'Failed to dismiss alert');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    // Asset management routes
    api.post('/assets/upload', async (request, reply) => {
      return handleAssetUpload(request, reply);
    });

    api.get('/assets/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      const { id } = request.params as { id: string };
      const asset = await getAssetById(id);
      if (!asset) {
        return reply.code(404).send({ error: 'Asset not found' });
      }
      return { asset };
    });

    api.get('/assets/list', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      try {
        const { gameId, assetType, mediaType, isReusable, search } = request.query as {
          gameId?: string;
          assetType?: string;
          mediaType?: string;
          isReusable?: string;
          search?: string;
        };
        return await listAssets({
          gameId,
          assetType,
          mediaType,
          isReusable: isReusable === 'true',
          search
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to list assets');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.delete('/assets/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_games')) return;
      try {
        const { id } = request.params as { id: string };
        return await deleteAsset(id, session.user.id as string, session.user.role);
      } catch (error) {
        request.log.error({ err: error }, 'Failed to delete asset');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.post('/assets/link', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_games')) return;
      try {
        const { assetId, gameId, usageType, puzzleId } = request.body as {
          assetId: string;
          gameId: string;
          usageType: 'thumbnail' | 'room_bg' | 'gallery' | 'puzzle' | 'hint';
          puzzleId?: string;
        };
        return await linkReusableAsset({ assetId, gameId, usageType, puzzleId });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to link asset');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.get('/admin/storage/metrics', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      try {
        return await getStorageMetrics();
      } catch (error) {
        request.log.error({ err: error }, 'Failed to get storage metrics');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    // ============================================================================
    // SYSTEM SETTINGS MANAGEMENT
    // ============================================================================

    api.get('/admin/settings', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_system_health')) return;

      try {
        const grouped = await settings.getAll();
        return { settings: grouped };
      } catch (error) {
        request.log.error({ err: error }, 'Failed to get settings');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.put('/admin/settings/:key', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_system_health')) return;

      const { key } = request.params as { key: string };
      const { value } = request.body as { value: any };

      if (value === undefined) {
        return reply.status(400).send({ statusCode: 400, message: 'Value is required' });
      }

      try {
        await settings.set(key as any, value, session.user.id);
        return { success: true, key, value };
      } catch (error) {
        request.log.error({ err: error, key }, 'Failed to update setting');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    // ============================================================================
    // SYSTEM HEALTH & BACKUPS
    // ============================================================================

    api.get('/admin/system/health', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_system_health')) return;

      const { getCurrentSystemHealth } = await import('./system/health.js');
      try {
        return await getCurrentSystemHealth(io);
      } catch (error) {
        request.log.error({ err: error }, 'Failed to get system health');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.post('/admin/backups', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_storage')) return;

      const { createBackupSchema } = await import('@escapeplan/contracts');
      const parsed = createBackupSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      const { createBackup } = await import('./system/backup.js');
      try {
        const backup = await createBackup({
          ...parsed.data,
          createdBy: session.user.id
        });
        return backup;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create backup');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.get('/admin/backups', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_storage')) return;

      const { destination } = request.query as { destination?: 'local' | 'usb' };
      const { listBackups } = await import('./system/backup.js');
      try {
        return await listBackups(destination);
      } catch (error) {
        request.log.error({ err: error }, 'Failed to list backups');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.delete('/admin/backups/:id', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_storage')) return;

      const { id } = request.params as { id: string };
      const { deleteBackup } = await import('./system/backup.js');
      try {
        await deleteBackup(id);
        return { success: true };
      } catch (error) {
        request.log.error({ err: error, backupId: id }, 'Failed to delete backup');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.get('/admin/usb-devices', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_storage')) return;

      const { scanUSBDevices } = await import('./system/usb.js');
      try {
        return await scanUSBDevices();
      } catch (error) {
        request.log.error({ err: error }, 'Failed to scan USB devices');
        return reply.status(500).send({ statusCode: 500, message: (error as Error).message });
      }
    });

    api.get('/bookings', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;

      const { date, scope = 'all' } = request.query as { date?: string; scope?: 'all' | 'storefront' | 'mobile' };
      if (!date) {
        return reply.status(400).send({ statusCode: 400, message: 'date query parameter required (YYYY-MM-DD)' });
      }

      return getBookingsByDate(date, scope);
    });

    api.post('/sessions/quick-start', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_sessions')) return;
      const parsed = quickStartSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }
      try {
        const result = quickStartSession(parsed.data, session.user.id as string);
        return result;
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create ad-hoc session');
        return reply.status(400).send({ statusCode: 400, message: (error as Error).message });
      }
    });

    api.get('/sessions', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_sessions')) return;

      const query = request.query as { status?: string; search?: string; sortBy?: 'date' | 'game' | 'location'; sortOrder?: 'asc' | 'desc' };
      return listSessions({
        status: query.status,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder
      });
    });

    api.get('/sessions/active', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_sessions')) return;
      return listActiveSessions();
    });

    api.get('/sessions/:sessionId', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_sessions')) return;

      const { sessionId } = request.params as { sessionId: string };
      const sessionRecord = getSessionById(sessionId);
      if (!sessionRecord) {
        return reply.status(404).send({ statusCode: 404, message: 'Session not found' });
      }
      return sessionRecord;
    });

    api.post('/sessions/:sessionId/commands', async (request, reply) => {
      const session = await ensureAuth(request, reply);
      if (!session) return;
      if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_sessions')) return;

      const { sessionId } = request.params as { sessionId: string };
      const parsed = sessionCommandSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid request', details: parsed.error.flatten() });
      }

      try {
        const result = applyCommand(sessionId, parsed.data);
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

  }, { prefix: '/api' });

  const io = new SocketServer(app.server, {
    cors: { origin: webOrigin, credentials: true }
  });

  attachRealtime(io);

  io.use(async (socket, next) => {
    try {
      const session = await requireSession(socket.handshake.headers as Record<string, string | string[] | undefined>);
      if (!session) {
        return next(new Error('Unauthorized'));
      }
      socket.data.user = session.user;
      next();
    } catch (error) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.emit('dashboard:update', getDashboard());
    socket.emit('session:update:init', listActiveSessions().sessions);
  });

  return app;
}

const skipAutostart = process.env.ESCAPEPLAN_SKIP_AUTOSTART === '1';
const isVitest = typeof process.env.VITEST_WORKER_ID !== 'undefined';
const isTestEnv = process.env.NODE_ENV === 'test' || isVitest;

if (!skipAutostart && !isTestEnv) {
  const server = await buildServer();
  try {
    // Seed default system settings if needed
    await seedSystemSettings();

    // Initialize settings manager
    await initializeSettings();

    await server.listen({ port: DEFAULT_PORT, host: '0.0.0.0' });
    server.log.info(`EscapePlan API listening on http://localhost:${DEFAULT_PORT}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}
