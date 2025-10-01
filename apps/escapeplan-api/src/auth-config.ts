import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, customSession, username } from 'better-auth/plugins';
import argon2 from 'argon2';
import type { BetterAuthOptions } from 'better-auth';
import type { OperatorPermission, OperatorRole } from '@escapeplan/contracts';
import { db } from './db/client.js';
import { operatorAccounts, operatorAuthSessions, operatorVerifications, operators } from './db/schema.js';
import { normalizePermissions, normalizeRole } from './security.js';

const DEFAULT_BASE_URL = process.env.AUTH_BASE_URL ?? 'http://localhost:4000/api/auth';
const WEB_ORIGIN = process.env.WEB_APP_ORIGIN ?? 'http://localhost:5173';

export type EscapePlanAuthOptions = BetterAuthOptions;

function buildBaseOptions(): BetterAuthOptions {
  const database = drizzleAdapterWithSerialization(db, {
    schema: {
      operators,
      operator_accounts: operatorAccounts,
      operator_auth_sessions: operatorAuthSessions,
      operator_verifications: operatorVerifications
    },
    provider: 'sqlite'
  });

  return {
    baseURL: DEFAULT_BASE_URL,
    trustedOrigins: [WEB_ORIGIN],
    database,
    user: {
      modelName: 'operators',
      fields: {
        email: 'email',
        name: 'name',
        image: 'avatar_config',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        emailVerified: 'email_verified'
      },
      additionalFields: {
        username: {
          type: 'string',
          required: true
        },
        role: {
          type: 'string',
          required: true,
          input: true,
          defaultValue: 'manager',
          fieldName: 'role'
        },
        permissions: {
          type: 'string',
          required: false,
          input: false,
          fieldName: 'permissions'
        },
        passwordHash: {
          type: 'string',
          required: false,
          input: false,
          fieldName: 'password_hash'
        },
        bio: {
          type: 'string',
          required: false,
          input: true,
          fieldName: 'bio'
        },
        mustResetPassword: {
          type: 'boolean',
          required: false,
          input: true,
          defaultValue: false,
          fieldName: 'must_reset_password'
        },
        lastLoginAt: {
          type: 'string',
          required: false,
          input: false,
          fieldName: 'last_login_at'
        },
        banned: {
          type: 'boolean',
          required: false,
          input: false,
          defaultValue: false,
          fieldName: 'banned'
        },
        banReason: {
          type: 'string',
          required: false,
          input: false,
          fieldName: 'ban_reason'
        },
        banExpires: {
          type: 'string',
          required: false,
          input: false,
          fieldName: 'ban_expires'
        },
        archivedAt: {
          type: 'string',
          required: false,
          input: false,
          fieldName: 'archived_at'
        },
        archivedBy: {
          type: 'string',
          required: false,
          input: false,
          fieldName: 'archived_by'
        },
        archivedReason: {
          type: 'string',
          required: false,
          input: false,
          fieldName: 'archived_reason'
        }
      }
    },
    session: {
      modelName: 'operator_auth_sessions',
      fields: {
        token: 'token',
        userId: 'user_id',
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent'
      }
    },
    account: {
      modelName: 'operator_accounts',
      fields: {
        accountId: 'account_id',
        providerId: 'provider_id',
        userId: 'user_id',
        password: 'password',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
      }
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 12,
      password: {
        hash: async (password) =>
          argon2.hash(password, { type: argon2.argon2id }),
        verify: async ({ hash, password }) => argon2.verify(hash, password)
      }
    },
    advanced: {
      useSecureCookies: false
    },
    plugins: [
      username({
        minUsernameLength: 4,
        maxUsernameLength: 64,
        usernameNormalization: (value) => value.trim().toLowerCase()
      }),
      admin({
        defaultRole: 'manager',
        adminRoles: ['admin']
      }),
      customSession(async ({ user, session }) => {
        const enrichedUser = user as Record<string, unknown> & {
          role?: string;
          permissions?: unknown;
          archivedAt?: unknown;
          image?: unknown;
        };

        const rawRole = typeof enrichedUser.role === 'string' ? enrichedUser.role : String(enrichedUser.role ?? '');
        const role = normalizeRole(rawRole);
        const storedPermissions =
          typeof enrichedUser.permissions === 'string' ? enrichedUser.permissions : null;
        const mergedPermissions = normalizePermissions(role, storedPermissions ?? undefined);

        if (typeof enrichedUser.archivedAt === 'string' && enrichedUser.archivedAt) {
          throw new Error('Account is archived');
        }

        // Transform Better Auth's 'image' field to 'avatarConfig' for frontend compatibility
        let avatarConfig;
        if (enrichedUser.image) {
          try {
            avatarConfig = typeof enrichedUser.image === 'string'
              ? JSON.parse(enrichedUser.image)
              : enrichedUser.image;
          } catch {
            avatarConfig = undefined;
          }
        }

        const { image, ...userWithoutImage } = enrichedUser;

        return {
          user: {
            ...userWithoutImage,
            role,
            permissions: mergedPermissions,
            avatarConfig
          },
          session
        };
      })
    ]
  } satisfies BetterAuthOptions;
}

export function createAuth(overrides: Partial<BetterAuthOptions> = {}) {
  const base = buildBaseOptions();
  const mergedPlugins = [
    ...(base.plugins ?? []),
    ...(overrides.plugins ?? [])
  ];

  return betterAuth({
    ...base,
    ...overrides,
    plugins: mergedPlugins
  });
}

export type EscapePlanAuthInstance = ReturnType<typeof createAuth>;
export type { OperatorRole, OperatorPermission };
export { DEFAULT_BASE_URL, WEB_ORIGIN };

function serializeDates(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeDates(entry));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeDates(entry)])
    );
  }
  return value;
}

function drizzleAdapterWithSerialization(...params: Parameters<typeof drizzleAdapter>) {
  const baseFactory = drizzleAdapter(...params);
  return (options: Parameters<ReturnType<typeof drizzleAdapter>>[0]) => {
    const baseAdapter = baseFactory(options);
    return {
      ...baseAdapter,
      create: async (args: Parameters<typeof baseAdapter.create>[0]) => {
        const data = args.data ? (serializeDates(args.data) as typeof args.data) : args.data;
        return baseAdapter.create({ ...args, data });
      },
      update: async (args: Parameters<typeof baseAdapter.update>[0]) => {
        const withTimestamp =
          args.update && typeof args.update === 'object' && !Array.isArray(args.update) && !('updatedAt' in args.update)
            ? ({ ...args.update, updatedAt: new Date() } as typeof args.update)
            : args.update;
        const update = withTimestamp ? (serializeDates(withTimestamp) as typeof withTimestamp) : withTimestamp;
        return baseAdapter.update({ ...args, update });
      },
      updateMany: async (args: Parameters<typeof baseAdapter.updateMany>[0]) => {
        const withTimestamp =
          args.update && typeof args.update === 'object' && !Array.isArray(args.update) && !('updatedAt' in args.update)
            ? ({ ...args.update, updatedAt: new Date() } as typeof args.update)
            : args.update;
        const update = withTimestamp ? (serializeDates(withTimestamp) as typeof withTimestamp) : withTimestamp;
        return baseAdapter.updateMany({ ...args, update });
      }
    };
  };
}
