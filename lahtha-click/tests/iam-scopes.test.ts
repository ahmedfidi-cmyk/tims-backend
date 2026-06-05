import { describe, it, expect } from 'vitest';
import { deriveScopes, hasScope, isElevatedScope, SCOPES } from '../src/domains/iam/scopes.js';
import {
  generateOtpCode,
  hashOtpCode,
  otpExpiryFrom,
  verifyOtp,
  OTP_MAX_ATTEMPTS,
} from '../src/domains/iam/otp.js';
import {
  hashSessionToken,
  issueSessionToken,
  sessionLifetimesFrom,
  sessionValidity,
  slideIdleExpiry,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
} from '../src/domains/iam/session.js';

describe('IAM scopes', () => {
  it('LAHTHA login grants only base scopes — never click access', () => {
    const scopes = deriveScopes(false, false);
    expect(scopes).toContain(SCOPES.LAHTHA_ACCESS);
    expect(scopes).not.toContain(SCOPES.CLICK_ACCESS);
  });

  it('approval alone does NOT grant click access without MFA', () => {
    expect(deriveScopes(true, false)).not.toContain(SCOPES.CLICK_ACCESS);
  });

  it('MFA alone does NOT grant click access without approval', () => {
    expect(deriveScopes(false, true)).not.toContain(SCOPES.CLICK_ACCESS);
  });

  it('approval + MFA together unlock the elevated scopes', () => {
    const scopes = deriveScopes(true, true);
    expect(scopes).toEqual(
      expect.arrayContaining([SCOPES.CLICK_ACCESS, SCOPES.CLICK_WALLET_WRITE, SCOPES.SETTLEMENT_WRITE]),
    );
  });

  it('classifies elevated vs base scopes', () => {
    expect(isElevatedScope(SCOPES.CLICK_ACCESS)).toBe(true);
    expect(isElevatedScope(SCOPES.LAHTHA_ACCESS)).toBe(false);
  });

  it('hasScope checks membership', () => {
    expect(hasScope([SCOPES.LAHTHA_ACCESS], SCOPES.LAHTHA_ACCESS)).toBe(true);
    expect(hasScope([SCOPES.LAHTHA_ACCESS], SCOPES.CLICK_ACCESS)).toBe(false);
  });
});

describe('OTP', () => {
  const pepper = 'test-pepper';

  it('generates a 6-digit numeric code', () => {
    for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it('accepts the correct code before expiry', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const code = '123456';
    const challenge = {
      codeHash: hashOtpCode(code, pepper),
      expiresAt: otpExpiryFrom(now),
      attempts: 0,
      consumedAt: null,
    };
    expect(verifyOtp(challenge, code, pepper, now)).toEqual({ ok: true });
  });

  it('rejects a wrong code as mismatch', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const challenge = {
      codeHash: hashOtpCode('123456', pepper),
      expiresAt: otpExpiryFrom(now),
      attempts: 0,
      consumedAt: null,
    };
    expect(verifyOtp(challenge, '000000', pepper, now)).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects an expired code', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const challenge = {
      codeHash: hashOtpCode('123456', pepper),
      expiresAt: otpExpiryFrom(now),
      attempts: 0,
      consumedAt: null,
    };
    const later = new Date(now.getTime() + 10 * 60_000);
    expect(verifyOtp(challenge, '123456', pepper, later)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects once the attempt budget is exhausted', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const challenge = {
      codeHash: hashOtpCode('123456', pepper),
      expiresAt: otpExpiryFrom(now),
      attempts: OTP_MAX_ATTEMPTS,
      consumedAt: null,
    };
    expect(verifyOtp(challenge, '123456', pepper, now)).toEqual({
      ok: false,
      reason: 'too_many_attempts',
    });
  });

  it('rejects an already-consumed challenge', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const challenge = {
      codeHash: hashOtpCode('123456', pepper),
      expiresAt: otpExpiryFrom(now),
      attempts: 0,
      consumedAt: now,
    };
    expect(verifyOtp(challenge, '123456', pepper, now)).toEqual({ ok: false, reason: 'consumed' });
  });
});

describe('sessions', () => {
  it('issues a token whose stored hash matches', () => {
    const { token, tokenHash } = issueSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).toBe(tokenHash);
  });

  it('is active within both windows', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const lt = sessionLifetimesFrom(now);
    expect(sessionValidity({ ...lt, revokedAt: null }, now)).toBe('active');
  });

  it('idle-expires before the absolute cap', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const lt = sessionLifetimesFrom(now);
    const afterIdle = new Date(now.getTime() + SESSION_IDLE_TTL_MS + 1);
    expect(sessionValidity({ ...lt, revokedAt: null }, afterIdle)).toBe('idle_expired');
  });

  it('absolute-expires at the hard cap', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const lt = sessionLifetimesFrom(now);
    const afterAbs = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS + 1);
    expect(sessionValidity({ ...lt, revokedAt: null }, afterAbs)).toBe('absolute_expired');
  });

  it('reports revoked sessions', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const lt = sessionLifetimesFrom(now);
    expect(sessionValidity({ ...lt, revokedAt: now }, now)).toBe('revoked');
  });

  it('slides the idle window but never past the absolute cap', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const lt = sessionLifetimesFrom(now);
    // Near the absolute cap, the slid idle expiry is clamped to it.
    const nearEnd = new Date(lt.absoluteExpiresAt.getTime() - 1000);
    const slid = slideIdleExpiry({ ...lt, revokedAt: null }, nearEnd);
    expect(slid.getTime()).toBe(lt.absoluteExpiresAt.getTime());
  });
});
