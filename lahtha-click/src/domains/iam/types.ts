// Domain entities and hexagonal ports for the IAM (identity + session) slice.
//
// Use cases depend only on these interfaces — never on Mongoose or Express — so
// the business logic is exercised against in-memory adapters in unit tests and
// against Mongo/Entra adapters in production.

import type { OtpChannel } from './otp.js';
import type { Scope } from './scopes.js';

// --- Entities ---

export interface VendorIdentity {
  vendorId: string;
  businessName: string;
  email: string;
  phone: string;
  /** Linked RBAC person (the human owner). */
  personId: string;
  /** Linked RBAC vendor principal — the session's authenticated user. */
  userId: string;
  createdAt: Date;
}

export interface OtpChallenge {
  challengeId: string;
  vendorId: string;
  channel: OtpChannel;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface Session {
  sessionId: string;
  tokenHash: string;
  vendorId: string;
  /** RBAC principal bound to this session (from the linked vendor identity). */
  userId: string;
  scopes: Scope[];
  mfaVerified: boolean;
  device: { userAgent?: string; ip?: string } | null;
  createdAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

// --- Ports (driven adapters) ---

export interface VendorIdentityRepository {
  create(identity: VendorIdentity): Promise<VendorIdentity>;
  findById(vendorId: string): Promise<VendorIdentity | null>;
  findByEmail(email: string): Promise<VendorIdentity | null>;
}

export interface OtpChallengeRepository {
  create(challenge: OtpChallenge): Promise<OtpChallenge>;
  /** Most recent un-consumed challenge for a vendor, if any. */
  findActiveByVendor(vendorId: string): Promise<OtpChallenge | null>;
  incrementAttempts(challengeId: string): Promise<void>;
  markConsumed(challengeId: string, when: Date): Promise<void>;
}

export interface SessionRepository {
  create(session: Session): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  updateScopesAndMfa(sessionId: string, scopes: Scope[], mfaVerified: boolean): Promise<void>;
  touchIdleExpiry(sessionId: string, idleExpiresAt: Date): Promise<void>;
  revoke(sessionId: string, when: Date): Promise<void>;
}

/** Knows whether a vendor has cleared LAHTHA approval (Rule 4 gate source). */
export interface VendorStatusPort {
  isApproved(vendorId: string): Promise<boolean>;
}

/**
 * Provisions (or links) the RBAC person + principal for a registering vendor,
 * so the session can carry a real `userId`. Implemented over the RBAC service.
 */
export interface VendorAccountProvisioner {
  provision(input: {
    businessName: string;
    ownerFullName: string;
    phone: string;
    principalType: 'vendor' | 'customer';
    nationalId?: string;
  }): Promise<{ personId: string; userId: string }>;
}

/** Delivers an OTP code to the vendor. Implementations: SMS, email, log (dev). */
export interface OtpSenderPort {
  send(args: { vendorId: string; channel: OtpChannel; code: string }): Promise<void>;
}

export interface MfaClaims {
  subject: string;
  issuer: string;
  /** Vendor this MFA assertion is bound to, when present. */
  vendorId?: string;
}

/** Verifies an MFA assertion (e.g. a Microsoft Entra OIDC ID token). */
export interface MfaVerifierPort {
  verify(idToken: string): Promise<MfaClaims>;
}

/** Injectable clock so expiry logic is deterministic in tests. */
export interface Clock {
  now(): Date;
}

/** Minimal structured logger surface (satisfied by a pino instance). */
export interface AuditLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
}

/** Raised by MFA adapters when an assertion is invalid. */
export class MfaVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MfaVerificationError';
  }
}
