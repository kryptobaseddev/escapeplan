import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { customSession, username } from 'better-auth/plugins';
import argon2 from 'argon2';
import type { BetterAuthOptions } from 'better-auth';
import type { OperatorPermission, OperatorRole } from '@escapeplan/contracts';
import { runtime } from '@escapeplan/contracts/runtime';
import { db, sqlite } from './db/client.js';
import { user, session, account, verification } from '@escapeplan/contracts';

const DEFAULT_BASE_URL = process.env.AUTH_BASE_URL ?? 'http://localhost:4000/api/auth';
const WEB_ORIGIN = process.env.WEB_APP_ORIGIN ?? 'http://localhost:5173';

export type EscapePlanAuthOptions = BetterAuthOptions;

function buildBaseOptions(): BetterAuthOptions {
  const database = drizzleAdapterWithSerialization(db, {
    schema: {
      user,      // Native singular table (no modelName override needed)
      session,   // Native singular table
      account,   // Native singular table
      verification // Native singular table
    },
    provider: 'sqlite'
  });

  return {
    baseURL: DEFAULT_BASE_URL,
    trustedOrigins: [WEB_ORIGIN],
    database,
    user: {
      // NO modelName override - native singular table names
      additionalFields: {
        username: {
          type: 'string',
          fieldName: 'username',
          required: true,
          returned: true,
          input: true
        },
        user_type: {
          type: 'string',
          fieldName: 'user_type',
          required: true,
          returned: true,
          input: false,  // Server-managed only
          defaultValue: 'operator'
        },
        role_id: {
          type: 'string',
          fieldName: 'role_id',
          required: true,
          returned: true,
          input: false,  // Server-managed only
          defaultValue: 'role-manager'
        },
        bio: {
          type: 'string',
          fieldName: 'bio',
          required: false,
          returned: true,
          input: true
        },
        avatar_config: {
          type: 'string',  // JSON stringified
          fieldName: 'avatar_config',
          required: false,
          returned: true,
          input: true
        },
        must_reset_password: {
          type: 'boolean',
          fieldName: 'must_reset_password',
          required: false,
          returned: true,
          input: false,
          defaultValue: false
        },
        loyalty_points: {
          type: 'number',
          fieldName: 'loyalty_points',
          required: false,
          returned: true,
          input: false  // Server-managed only
        },
        preferred_difficulty: {
          type: 'string',
          fieldName: 'preferred_difficulty',
          required: false,
          returned: true,
          input: true
        },
        marketing_opted_in: {
          type: 'boolean',
          fieldName: 'marketing_opted_in',
          required: false,
          returned: true,
          input: true,
          defaultValue: false
        },
        last_login_at: {
          type: 'string',
          fieldName: 'last_login_at',
          required: false,
          returned: true,
          input: false
        },
        banned: {
          type: 'boolean',
          fieldName: 'banned',
          required: false,
          returned: true,
          input: false,
          defaultValue: false
        },
        ban_reason: {
          type: 'string',
          fieldName: 'ban_reason',
          required: false,
          returned: true,
          input: false
        },
        ban_expires: {
          type: 'string',
          fieldName: 'ban_expires',
          required: false,
          returned: true,
          input: false
        },
        archived_at: {
          type: 'string',
          fieldName: 'archived_at',
          required: false,
          returned: true,
          input: false
        },
        archived_by: {
          type: 'string',
          fieldName: 'archived_by',
          required: false,
          returned: true,
          input: false
        },
        archived_reason: {
          type: 'string',
          fieldName: 'archived_reason',
          required: false,
          returned: true,
          input: false
        }
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
      useSecureCookies: runtime.isProduction
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60 // 5 minutes
      }
    },
    socialProviders: {},
    plugins: [
      username({
        minUsernameLength: 4,
        maxUsernameLength: 64,
        usernameNormalization: (value) => value.trim().toLowerCase()
      }),
      customSession(async ({ user, session }) => {
        const enrichedUser = user as Record<string, unknown> & {
          id: string;
          user_type?: string;
          role_id?: string;
          archived_at?: string | null;
          image?: unknown;
        };

        // Block archived users
        if (enrichedUser.archived_at) {
          throw new Error('Account is archived');
        }

        // Derive permissions from role_id (database-driven RBAC)
        const permissions = await getUserPermissionsFromDB(enrichedUser.id);

        // Get role details
        const role = await getRoleFromDB(enrichedUser.role_id);

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
            role: role?.name || 'unknown',  // Normalized role name for frontend
            permissions,  // Array of permission names
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

// Helper: Get permissions from database
async function getUserPermissionsFromDB(userId: string): Promise<string[]> {
  const result = sqlite.prepare(`
    SELECT DISTINCT p.name
    FROM user u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = ?
  `).all(userId) as { name: string }[];

  return result.map(row => row.name);
}

// Helper: Get role from database
async function getRoleFromDB(roleId: string | undefined): Promise<{ id: string; name: string } | null> {
  if (!roleId) return null;

  const result = sqlite.prepare(`
    SELECT id, name FROM roles WHERE id = ? LIMIT 1
  `).get(roleId) as { id: string; name: string } | undefined;

  return result || null;
}

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
