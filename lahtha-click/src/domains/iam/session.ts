// Session token primitives — pure logic.
//
// The bearer token is opaque random bytes; only its SHA-256 hash is stored, so
// a database leak does not expose live tokens. Sessions have a sliding idle
// window and a hard absolute lifetime (per docs/architecture/iam-rbac.md).

import { createHash, randomBytes } from 'node:crypto';

export const SESSION_IDLE_TTL_MS = 12 * 60 * 60_000; // 12h sliding
export const SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60_000; // 7d hard cap

export interface IssuedToken {
  /** Returned to the client once; never stored. */
  token: string;
  /** Stored server-side for lookup. */
  tokenHash: string;
}

/** Mint a new opaque token and its storable hash. */
export function issueSessionToken(): IssuedToken {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashSessionToken(token) };
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Timestamps for a session created at `now`. */
export interface SessionLifetimes {
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export function sessionLifetimesFrom(now: Date): SessionLifetimes {
  return {
    idleExpiresAt: new Date(now.getTime() + SESSION_IDLE_TTL_MS),
    absoluteExpiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS),
  };
}

export interface SessionTiming {
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

export type SessionValidity = 'active' | 'revoked' | 'idle_expired' | 'absolute_expired';

/** Pure validity check against the clock. */
export function sessionValidity(s: SessionTiming, now: Date): SessionValidity {
  if (s.revokedAt !== null) return 'revoked';
  if (now.getTime() >= s.absoluteExpiresAt.getTime()) return 'absolute_expired';
  if (now.getTime() >= s.idleExpiresAt.getTime()) return 'idle_expired';
  return 'active';
}

export function isSessionActive(s: SessionTiming, now: Date): boolean {
  return sessionValidity(s, now) === 'active';
}

/**
 * Slide the idle window forward, never past the absolute cap. Returns the new
 * idle expiry to persist on each authenticated request.
 */
export function slideIdleExpiry(s: SessionTiming, now: Date): Date {
  const candidate = now.getTime() + SESSION_IDLE_TTL_MS;
  return new Date(Math.min(candidate, s.absoluteExpiresAt.getTime()));
}
