import { describe, it, expect, beforeEach } from 'vitest';
import {
  authenticate,
  IdentityConflictError,
  IdentityNotFoundError,
  logout,
  OtpError,
  registerVendorIdentity,
  requestOtp,
  SessionInvalidError,
  stepUpMfa,
  verifyOtpAndLogin,
  type IamDeps,
} from '../src/domains/iam/use-cases.js';
import { SCOPES } from '../src/domains/iam/scopes.js';
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS } from '../src/domains/iam/session.js';
import {
  CapturingOtpSender,
  FakeMfaVerifier,
  FixedClock,
  InMemoryOtpChallengeRepository,
  InMemorySessionRepository,
  InMemoryVendorIdentityRepository,
  InMemoryVendorStatus,
} from '../src/domains/iam/in-memory-adapters.js';

const silentLogger = { info: () => {}, warn: () => {} };

function harness(mfaTokens: Record<string, { subject: string; issuer: string; vendorId?: string }> = {}) {
  const clock = new FixedClock(new Date('2026-06-05T00:00:00Z'));
  const otpSender = new CapturingOtpSender();
  const vendorStatus = new InMemoryVendorStatus();
  const deps: IamDeps = {
    identities: new InMemoryVendorIdentityRepository(),
    otps: new InMemoryOtpChallengeRepository(),
    sessions: new InMemorySessionRepository(),
    vendorStatus,
    otpSender,
    mfa: new FakeMfaVerifier(mfaTokens),
    clock,
    logger: silentLogger,
    otpPepper: 'test-pepper',
  };
  return { deps, clock, otpSender, vendorStatus };
}

const reg = { businessName: 'Acme Devices', email: 'ops@acme.test', phone: '+966500000000' };

async function registerAndLogin(h: ReturnType<typeof harness>) {
  const identity = await registerVendorIdentity(h.deps, reg);
  await requestOtp(h.deps, { vendorId: identity.vendorId, channel: 'sms' });
  const code = h.otpSender.lastCodeFor(identity.vendorId)!;
  const { token, session } = await verifyOtpAndLogin(h.deps, { vendorId: identity.vendorId, code });
  return { identity, token, session };
}

describe('IAM auth use cases', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it('registers an identity and rejects duplicate emails', async () => {
    await registerVendorIdentity(h.deps, reg);
    await expect(registerVendorIdentity(h.deps, reg)).rejects.toBeInstanceOf(IdentityConflictError);
  });

  it('requestOtp on an unknown vendor 404s', async () => {
    await expect(requestOtp(h.deps, { vendorId: 'nope', channel: 'sms' })).rejects.toBeInstanceOf(
      IdentityNotFoundError,
    );
  });

  it('logs in with a valid OTP and gets only base scopes', async () => {
    const { session } = await registerAndLogin(h);
    expect(session.scopes).toContain(SCOPES.LAHTHA_ACCESS);
    expect(session.scopes).not.toContain(SCOPES.CLICK_ACCESS);
    expect(session.mfaVerified).toBe(false);
  });

  it('rejects a wrong OTP and burns an attempt', async () => {
    const identity = await registerVendorIdentity(h.deps, reg);
    await requestOtp(h.deps, { vendorId: identity.vendorId, channel: 'sms' });
    await expect(
      verifyOtpAndLogin(h.deps, { vendorId: identity.vendorId, code: '000000' }),
    ).rejects.toBeInstanceOf(OtpError);
    const challenge = await h.deps.otps.findActiveByVendor(identity.vendorId);
    expect(challenge?.attempts).toBe(1);
  });

  it('a consumed OTP cannot be reused', async () => {
    const { identity } = await registerAndLogin(h);
    // Re-verifying finds the consumed challenge -> no active challenge.
    await expect(
      verifyOtpAndLogin(h.deps, { vendorId: identity.vendorId, code: '123456' }),
    ).rejects.toBeInstanceOf(OtpError);
  });

  it('authenticate resolves a live session and slides idle expiry', async () => {
    const { token } = await registerAndLogin(h);
    h.clock.advance(60_000);
    const session = await authenticate(h.deps, token);
    expect(session.idleExpiresAt.getTime()).toBe(h.clock.now().getTime() + SESSION_IDLE_TTL_MS);
  });

  it('rejects an idle-expired session', async () => {
    const { token } = await registerAndLogin(h);
    h.clock.advance(SESSION_IDLE_TTL_MS + 1);
    await expect(authenticate(h.deps, token)).rejects.toBeInstanceOf(SessionInvalidError);
  });

  it('rejects a revoked session after logout', async () => {
    const { token } = await registerAndLogin(h);
    const session = await authenticate(h.deps, token);
    await logout(h.deps, session);
    await expect(authenticate(h.deps, token)).rejects.toBeInstanceOf(SessionInvalidError);
  });

  it('never exceeds the absolute lifetime even with activity', async () => {
    const { token } = await registerAndLogin(h);
    // Keep touching just under the idle window until past the absolute cap.
    for (let elapsed = 0; elapsed < SESSION_ABSOLUTE_TTL_MS; elapsed += SESSION_IDLE_TTL_MS - 1000) {
      h.clock.advance(SESSION_IDLE_TTL_MS - 1000);
      try {
        await authenticate(h.deps, token);
      } catch {
        break;
      }
    }
    h.clock.set(new Date('2026-06-05T00:00:00Z'));
    h.clock.advance(SESSION_ABSOLUTE_TTL_MS + 1);
    await expect(authenticate(h.deps, token)).rejects.toBeInstanceOf(SessionInvalidError);
  });

  describe('MFA step-up', () => {
    it('step-up without approval verifies MFA but withholds click access', async () => {
      const h2 = harness({ 'good-token': { subject: 'oid-1', issuer: 'entra' } });
      const { token } = await registerAndLogin(h2);
      const session = await authenticate(h2.deps, token);
      const updated = await stepUpMfa(h2.deps, session, 'good-token');
      expect(updated.mfaVerified).toBe(true);
      expect(updated.scopes).not.toContain(SCOPES.CLICK_ACCESS);
    });

    it('step-up with approval + MFA unlocks click access', async () => {
      const h2 = harness({ 'good-token': { subject: 'oid-1', issuer: 'entra' } });
      const { identity, token } = await registerAndLogin(h2);
      h2.vendorStatus.approve(identity.vendorId);
      const session = await authenticate(h2.deps, token);
      const updated = await stepUpMfa(h2.deps, session, 'good-token');
      expect(updated.scopes).toContain(SCOPES.CLICK_ACCESS);
    });

    it('rejects an unknown MFA token', async () => {
      const h2 = harness();
      const { token } = await registerAndLogin(h2);
      const session = await authenticate(h2.deps, token);
      await expect(stepUpMfa(h2.deps, session, 'bogus')).rejects.toThrow();
    });

    it('rejects an MFA token bound to a different vendor', async () => {
      const h2 = harness({ 'mismatch-token': { subject: 'oid-x', issuer: 'entra', vendorId: 'someone-else' } });
      const { token } = await registerAndLogin(h2);
      const session = await authenticate(h2.deps, token);
      await expect(stepUpMfa(h2.deps, session, 'mismatch-token')).rejects.toThrow();
    });
  });
});
