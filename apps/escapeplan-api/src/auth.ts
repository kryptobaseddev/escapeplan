import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'http';
import type { OperatorPermission, OperatorRole } from '@escapeplan/contracts';
import { createAuth } from './auth-config.ts';
import { sqlite } from './db/client.js';
import { nanoid } from 'nanoid';

export const auth = createAuth();

type ResolvedSession = {
  session: {
    id: string;
    userId: string;
    token: string;
  } & Record<string, unknown>;
  user: {
    id: string;
    role: OperatorRole;
    permissions: OperatorPermission[];
  } & Record<string, unknown>;
};

export async function requireSession(headersSource: Record<string, string | number | string[] | undefined>) {
  const normalizedEntries = Object.entries(headersSource).map(([key, value]) => {
    if (Array.isArray(value)) {
      return [key, value.map((item) => String(item))];
    }
    if (value === undefined) {
      return [key, undefined];
    }
    return [key, String(value)];
  });

  const normalizedHeaders = Object.fromEntries(normalizedEntries) as IncomingHttpHeaders;
  const headers = fromNodeHeaders(normalizedHeaders);
  const session = await auth.api.getSession({ headers });
  return session as ResolvedSession | null;
}

/**
 * Issue a session token for a user
 * Creates a Better Auth session and returns token details
 */
export function issueToken(userId: string): {
  token: string;
  userId: string;
  mustResetPassword?: boolean;
} {
  // Generate a unique session token
  const token = `ep_${nanoid(48)}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const sessionId = nanoid(21);

  // Create session in database
  sqlite.prepare(`
    INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    userId,
    token,
    expiresAt.toISOString(),
    new Date().toISOString(),
    new Date().toISOString()
  );

  return {
    token,
    userId
  };
}

/**
 * Validate a session token and return user details
 * Returns null if token is invalid or expired
 */
export function validateToken(token: string): {
  id: string;
  username: string;
  name: string;
  role: OperatorRole;
  permissions: OperatorPermission[];
  mustResetPassword: boolean;
} | null {
  // Look up session by token
  const sessionRow = sqlite.prepare(`
    SELECT userId, expiresAt FROM session WHERE token = ? LIMIT 1
  `).get(token) as { userId: string; expiresAt: string } | undefined;

  if (!sessionRow) {
    return null;
  }

  // Check if session is expired
  const expiresAt = new Date(sessionRow.expiresAt);
  if (expiresAt < new Date()) {
    // Clean up expired session
    sqlite.prepare(`DELETE FROM session WHERE token = ?`).run(token);
    return null;
  }

  // Get user details
  const userRow = sqlite.prepare(`
    SELECT u.id, u.username, u.name, u.role_id, u.must_reset_password, r.name as role_name
    FROM user u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = ? AND u.archived_at IS NULL
    LIMIT 1
  `).get(sessionRow.userId) as {
    id: string;
    username: string;
    name: string;
    role_id: string;
    must_reset_password: number;
    role_name: string;
  } | undefined;

  if (!userRow) {
    return null;
  }

  // Get user permissions
  const permissionRows = sqlite.prepare(`
    SELECT DISTINCT p.name
    FROM user u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = ?
  `).all(sessionRow.userId) as { name: string }[];

  const permissions = permissionRows.map(row => row.name as OperatorPermission);
  const role = userRow.role_name as OperatorRole;

  return {
    id: userRow.id,
    username: userRow.username,
    name: userRow.name,
    role,
    permissions,
    mustResetPassword: Boolean(userRow.must_reset_password)
  };
}

/**
 * Describe a session by token
 * Returns session and user details for authenticated requests
 */
export function describeSession(
  token: string,
  user: ReturnType<typeof validateToken>
): {
  session: {
    token: string;
    userId: string;
  };
  user: {
    id: string;
    username: string;
    name: string;
    role: OperatorRole;
    permissions: OperatorPermission[];
    mustResetPassword: boolean;
  };
} | null {
  if (!user) {
    return null;
  }

  return {
    session: {
      token,
      userId: user.id
    },
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      mustResetPassword: user.mustResetPassword
    }
  };
}

export type { ResolvedSession };
