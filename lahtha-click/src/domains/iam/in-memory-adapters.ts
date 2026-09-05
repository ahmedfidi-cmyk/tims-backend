// In-memory adapters for the IAM ports. Used by unit tests (no live DB) and as
// the reference implementation of each port's contract.

import {
  MfaVerificationError,
  type Clock,
  type MfaClaims,
  type MfaVerifierPort,
  type OtpChallenge,
  type OtpChallengeRepository,
  type OtpSenderPort,
  type Session,
  type SessionRepository,
  type VendorIdentity,
  type VendorIdentityRepository,
  type VendorStatusPort,
} from './types.js';
import type { OtpChannel } from './otp.js';
import type { Scope } from './scopes.js';

export class InMemoryVendorIdentityRepository implements VendorIdentityRepository {
  private readonly byId = new Map<string, VendorIdentity>();

  async create(identity: VendorIdentity): Promise<VendorIdentity> {
    this.byId.set(identity.vendorId, { ...identity });
    return { ...identity };
  }
  async findById(vendorId: string): Promise<VendorIdentity | null> {
    const v = this.byId.get(vendorId);
    return v ? { ...v } : null;
  }
  async findByEmail(email: string): Promise<VendorIdentity | null> {
    for (const v of this.byId.values()) if (v.email === email) return { ...v };
    return null;
  }
}

export class InMemoryOtpChallengeRepository implements OtpChallengeRepository {
  private readonly byId = new Map<string, OtpChallenge>();

  async create(challenge: OtpChallenge): Promise<OtpChallenge> {
    this.byId.set(challenge.challengeId, { ...challenge });
    return { ...challenge };
  }
  async findActiveByVendor(vendorId: string): Promise<OtpChallenge | null> {
    const active = [...this.byId.values()]
      .filter((c) => c.vendorId === vendorId && c.consumedAt === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return active.length > 0 ? { ...active[0]! } : null;
  }
  async incrementAttempts(challengeId: string): Promise<void> {
    const c = this.byId.get(challengeId);
    if (c) c.attempts += 1;
  }
  async markConsumed(challengeId: string, when: Date): Promise<void> {
    const c = this.byId.get(challengeId);
    if (c) c.consumedAt = when;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly byId = new Map<string, Session>();
  private readonly byTokenHash = new Map<string, string>();

  async create(session: Session): Promise<Session> {
    this.byId.set(session.sessionId, { ...session });
    this.byTokenHash.set(session.tokenHash, session.sessionId);
    return { ...session };
  }
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const id = this.byTokenHash.get(tokenHash);
    if (!id) return null;
    const s = this.byId.get(id);
    return s ? { ...s } : null;
  }
  async updateScopesAndMfa(sessionId: string, scopes: Scope[], mfaVerified: boolean): Promise<void> {
    const s = this.byId.get(sessionId);
    if (s) {
      s.scopes = [...scopes];
      s.mfaVerified = mfaVerified;
    }
  }
  async touchIdleExpiry(sessionId: string, idleExpiresAt: Date): Promise<void> {
    const s = this.byId.get(sessionId);
    if (s) s.idleExpiresAt = idleExpiresAt;
  }
  async revoke(sessionId: string, when: Date): Promise<void> {
    const s = this.byId.get(sessionId);
    if (s) s.revokedAt = when;
  }
}

/** Approval status backed by a simple set; tests flip vendors to approved. */
export class InMemoryVendorStatus implements VendorStatusPort {
  private readonly approved = new Set<string>();
  approve(vendorId: string): void {
    this.approved.add(vendorId);
  }
  async isApproved(vendorId: string): Promise<boolean> {
    return this.approved.has(vendorId);
  }
}

/** Captures the last code per vendor instead of sending — for tests/dev. */
export class CapturingOtpSender implements OtpSenderPort {
  readonly sent: Array<{ vendorId: string; channel: OtpChannel; code: string }> = [];
  async send(args: { vendorId: string; channel: OtpChannel; code: string }): Promise<void> {
    this.sent.push({ ...args });
  }
  lastCodeFor(vendorId: string): string | undefined {
    return [...this.sent].reverse().find((s) => s.vendorId === vendorId)?.code;
  }
}

/** Accepts any token whose value matches a preconfigured map; else rejects. */
export class FakeMfaVerifier implements MfaVerifierPort {
  constructor(private readonly tokenToClaims: Record<string, MfaClaims> = {}) {}
  async verify(idToken: string): Promise<MfaClaims> {
    const claims = this.tokenToClaims[idToken];
    if (!claims) throw new MfaVerificationError('unknown or invalid MFA token');
    return claims;
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Advanceable clock for deterministic expiry tests. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(d: Date): void {
    this.current = new Date(d);
  }
}
