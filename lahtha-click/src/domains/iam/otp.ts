// One-time-password (OTP) — pure logic.
//
// Codes are never stored in clear: only an HMAC-SHA256 hash (keyed by a server
// pepper) is persisted. Verification is constant-time and bounded by an attempt
// budget and an absolute expiry. Generation, hashing and the verdict are all
// pure given their inputs + an injected clock, so they unit-test without I/O.

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60_000; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;

/** Channels an OTP can be delivered over. */
export const OTP_CHANNELS = ['sms', 'email'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'consumed' | 'too_many_attempts' | 'mismatch' };

/** State of an OTP challenge as the verifier needs to see it. */
export interface OtpChallengeState {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

/** Generate a zero-padded numeric code. Uses a CSPRNG (randomInt). */
export function generateOtpCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_CODE_LENGTH, '0');
}

/** Keyed hash of a code. The pepper must come from configuration/secrets. */
export function hashOtpCode(code: string, pepper: string): string {
  return createHmac('sha256', pepper).update(code).digest('hex');
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Pure verdict for a code against a stored challenge. Does not mutate state;
 * the caller persists the new attempt count / consumption.
 */
export function verifyOtp(
  challenge: OtpChallengeState,
  submittedCode: string,
  pepper: string,
  now: Date,
): OtpVerifyResult {
  if (challenge.consumedAt !== null) return { ok: false, reason: 'consumed' };
  if (now.getTime() >= challenge.expiresAt.getTime()) return { ok: false, reason: 'expired' };
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  const submittedHash = hashOtpCode(submittedCode, pepper);
  if (!constantTimeEquals(submittedHash, challenge.codeHash)) {
    return { ok: false, reason: 'mismatch' };
  }
  return { ok: true };
}

/** Expiry timestamp for a freshly issued challenge. */
export function otpExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + OTP_TTL_MS);
}
