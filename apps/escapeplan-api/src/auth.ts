import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'http';
import type { OperatorPermission, OperatorRole } from '@escapeplan/contracts';
import { createAuth } from './auth-config.ts';

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

export type { ResolvedSession };
