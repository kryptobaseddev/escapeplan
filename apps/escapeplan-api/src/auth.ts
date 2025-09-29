import { nanoid } from 'nanoid';
import type { LoginResponse, OperatorProfile, SessionResponse } from '@escapeplan/contracts';
import { findOperatorById } from './state.js';

interface TokenRecord {
  userId: string;
  expiresAt: number;
}

const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const tokenStore = new Map<string, TokenRecord>();

export function issueToken(userId: string): LoginResponse {
  const token = nanoid(32);
  const expiresAt = Date.now() + TWELVE_HOURS;
  tokenStore.set(token, { userId, expiresAt });

  const user = findOperatorById(userId);
  if (!user) {
    throw new Error('Unknown user');
  }

  return {
    token,
    user,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

export function validateToken(token: string): OperatorProfile | null {
  const record = tokenStore.get(token);
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    tokenStore.delete(token);
    return null;
  }
  const operator = findOperatorById(record.userId);
  return operator ?? null;
}

export function requireToken(authHeader?: string | null): OperatorProfile {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  const token = authHeader.split(' ')[1] ?? '';
  const user = validateToken(token);
  if (!user) {
    throw new Error('Session expired or invalid');
  }
  return user;
}

export function describeSession(token: string, user: OperatorProfile): SessionResponse {
  const record = tokenStore.get(token);
  if (!record) {
    throw new Error('Invalid session');
  }
  return {
    user,
    issuedAt: new Date(record.expiresAt - TWELVE_HOURS).toISOString(),
    expiresAt: new Date(record.expiresAt).toISOString()
  };
}
