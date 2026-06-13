// IAM use cases — pure orchestration over ports.
//
// Each function takes its dependencies (ports) explicitly, contains no HTTP or
// Mongoose knowledge, and emits structured audit events through the injected
// logger (VENDOR_OTP_REQUESTED, LOGIN_SUCCESS, MFA_VERIFIED, ...). This is the
// hexagonal "application core": fully testable with in-memory adapters.

import { randomUUID } from 'node:crypto';
import { generateOtpCode, hashOtpCode, otpExpiryFrom, verifyOtp } from './otp.js';
import { deriveScopes, type Scope } from './scopes.js';
import {
  hashSessionToken,
  isSessionActive,
  issueSessionToken,
  sessionLifetimesFrom,
  sessionValidity,
  slideIdleExpiry,
} from './session.js';
import {
  MfaVerificationError,
  type AuditLogger,
  type Clock,
  type MfaVerifierPort,
  type OtpChallengeRepository,
  type OtpSenderPort,
  type Session,
  type SessionRepository,
  type VendorAccountProvisioner,
  type VendorApprovalProvisioner,
  type VendorIdentity,
  type VendorIdentityRepository,
  type VendorStatusPort,
} from './types.js';
import type {
  RequestOtpByEmailInput,
  RequestOtpInput,
  VendorRegistrationInput,
  VerifyOtpByEmailInput,
  VerifyOtpInput,
} from './schemas.js';

export interface IamDeps {
  identities: VendorIdentityRepository;
  otps: OtpChallengeRepository;
  sessions: SessionRepository;
  vendorStatus: VendorStatusPort;
  provisioner: VendorAccountProvisioner;
  /** Optional: link a vendor-approval record at signup (shared id). */
  approvalProvisioner?: VendorApprovalProvisioner;
  otpSender: OtpSenderPort;
  mfa: MfaVerifierPort;
  clock: Clock;
  logger: AuditLogger;
  /** Server-side pepper for OTP hashing (from config/secrets). */
  otpPepper: string;
}

// --- Errors (mapped to HTTP at the controller) ---

export class IdentityConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'IdentityConflictError';
  }
}
export class IdentityNotFoundError extends Error {
  constructor(public readonly vendorId: string) {
    super(`Vendor identity ${vendorId} not found`);
    this.name = 'IdentityNotFoundError';
  }
}
export class OtpError extends Error {
  constructor(public readonly reason: string) {
    super(`OTP rejected: ${reason}`);
    this.name = 'OtpError';
  }
}
export class SessionInvalidError extends Error {
  constructor(public readonly reason: string) {
    super(`Session invalid: ${reason}`);
    this.name = 'SessionInvalidError';
  }
}

/** Client-safe view of a session (never leaks the token hash). */
export interface SessionView {
  sessionId: string;
  vendorId: string;
  userId: string;
  scopes: Scope[];
  mfaVerified: boolean;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export function toSessionView(s: Session): SessionView {
  return {
    sessionId: s.sessionId,
    vendorId: s.vendorId,
    userId: s.userId,
    scopes: s.scopes,
    mfaVerified: s.mfaVerified,
    idleExpiresAt: s.idleExpiresAt,
    absoluteExpiresAt: s.absoluteExpiresAt,
  };
}

// --- Use cases ---

/** RegisterVendorUseCase: create a LAHTHA vendor identity (KYC starts elsewhere). */
export async function registerVendorIdentity(
  deps: IamDeps,
  input: VendorRegistrationInput,
): Promise<VendorIdentity> {
  const existing = await deps.identities.findByEmail(input.email);
  if (existing) throw new IdentityConflictError(`email ${input.email} already registered`);

  // Bridge: link (or create) the RBAC person + vendor principal up front so the
  // session can carry a real userId.
  const { personId, userId } = await deps.provisioner.provision({
    businessName: input.businessName,
    ownerFullName: input.ownerFullName ?? input.businessName,
    phone: input.phone,
    principalType: input.principalType ?? 'vendor',
    ...(input.nationalId ? { nationalId: input.nationalId } : {}),
  });

  const identity: VendorIdentity = {
    vendorId: randomUUID(),
    businessName: input.businessName,
    email: input.email,
    phone: input.phone,
    personId,
    userId,
    createdAt: deps.clock.now(),
  };
  await deps.identities.create(identity);

  // Link a vendor-approval record (shared id) so the admin queue reflects signups.
  if ((input.principalType ?? 'vendor') === 'vendor' && deps.approvalProvisioner) {
    await deps.approvalProvisioner.createApprovalRecord({
      vendorId: identity.vendorId,
      userId,
      name: input.businessName,
      contactEmail: input.email,
    });
  }

  deps.logger.info(
    { event: 'VENDOR_REGISTERED', vendorId: identity.vendorId, personId, userId },
    'vendor identity registered',
  );
  return identity;
}

export interface OtpRequestResult {
  challengeId: string;
  channel: string;
  expiresAt: Date;
  /** Only populated in non-production for local testing; otherwise undefined. */
  devCode?: string;
}

/** RequestOtpUseCase: issue and deliver a one-time code. */
export async function requestOtp(
  deps: IamDeps,
  input: RequestOtpInput,
  opts: { exposeCode?: boolean } = {},
): Promise<OtpRequestResult> {
  const identity = await deps.identities.findById(input.vendorId);
  if (!identity) throw new IdentityNotFoundError(input.vendorId);

  const now = deps.clock.now();
  const code = generateOtpCode();
  const challenge = await deps.otps.create({
    challengeId: randomUUID(),
    vendorId: input.vendorId,
    channel: input.channel,
    codeHash: hashOtpCode(code, deps.otpPepper),
    expiresAt: otpExpiryFrom(now),
    attempts: 0,
    consumedAt: null,
    createdAt: now,
  });

  await deps.otpSender.send({ vendorId: input.vendorId, channel: input.channel, code });
  deps.logger.info(
    { event: 'VENDOR_OTP_REQUESTED', vendorId: input.vendorId, channel: input.channel },
    'otp requested',
  );

  return {
    challengeId: challenge.challengeId,
    channel: challenge.channel,
    expiresAt: challenge.expiresAt,
    ...(opts.exposeCode ? { devCode: code } : {}),
  };
}

export interface LoginResult {
  /** Opaque bearer token — returned once, set as an HttpOnly cookie. */
  token: string;
  session: SessionView;
}

/** VerifyOtpUseCase: validate a code and open a session with base scopes. */
export async function verifyOtpAndLogin(
  deps: IamDeps,
  input: VerifyOtpInput,
): Promise<LoginResult> {
  const identity = await deps.identities.findById(input.vendorId);
  if (!identity) throw new IdentityNotFoundError(input.vendorId);

  const challenge = await deps.otps.findActiveByVendor(input.vendorId);
  if (!challenge) {
    deps.logger.warn({ event: 'LOGIN_FAILED', vendorId: input.vendorId, reason: 'no_challenge' }, 'login failed');
    throw new OtpError('no_active_challenge');
  }

  const now = deps.clock.now();
  const verdict = verifyOtp(challenge, input.code, deps.otpPepper, now);
  if (!verdict.ok) {
    // A wrong code burns an attempt; structural failures (expired/consumed) do not.
    if (verdict.reason === 'mismatch') await deps.otps.incrementAttempts(challenge.challengeId);
    deps.logger.warn(
      { event: 'LOGIN_FAILED', vendorId: input.vendorId, reason: verdict.reason },
      'login failed',
    );
    throw new OtpError(verdict.reason);
  }

  await deps.otps.markConsumed(challenge.challengeId, now);

  // Base scopes only: CLICK/elevated stays locked until MFA step-up + approval.
  const approved = await deps.vendorStatus.isApproved(input.vendorId);
  const scopes = deriveScopes(approved, false);
  const { token, tokenHash } = issueSessionToken();
  const lifetimes = sessionLifetimesFrom(now);

  const session = await deps.sessions.create({
    sessionId: randomUUID(),
    tokenHash,
    vendorId: input.vendorId,
    userId: identity.userId,
    scopes,
    mfaVerified: false,
    device: input.device ?? null,
    createdAt: now,
    idleExpiresAt: lifetimes.idleExpiresAt,
    absoluteExpiresAt: lifetimes.absoluteExpiresAt,
    revokedAt: null,
  });

  deps.logger.info({ event: 'LOGIN_SUCCESS', vendorId: input.vendorId, sessionId: session.sessionId }, 'login success');
  return { token, session: toSessionView(session) };
}

/**
 * Email-keyed OTP request: resolve the identity by email, then delegate to the
 * vendorId-based flow. (Enumeration hardening — returning a neutral response for
 * unknown emails — is a follow-up; for now an unknown email is a 404.)
 */
export async function requestOtpByEmail(
  deps: IamDeps,
  input: RequestOtpByEmailInput,
  opts: { exposeCode?: boolean } = {},
): Promise<OtpRequestResult> {
  const identity = await deps.identities.findByEmail(input.email);
  if (!identity) throw new IdentityNotFoundError(input.email);
  return requestOtp(deps, { vendorId: identity.vendorId, channel: input.channel }, opts);
}

/** Email-keyed OTP verify + login: resolve by email, then delegate. */
export async function verifyOtpByEmailAndLogin(
  deps: IamDeps,
  input: VerifyOtpByEmailInput,
): Promise<LoginResult> {
  const identity = await deps.identities.findByEmail(input.email);
  if (!identity) throw new IdentityNotFoundError(input.email);
  return verifyOtpAndLogin(deps, {
    vendorId: identity.vendorId,
    code: input.code,
    ...(input.device ? { device: input.device } : {}),
  });
}

/**
 * StepUpMfaUseCase: verify a Microsoft Entra OIDC token and elevate the session.
 * Elevated scopes are only added when the vendor is ALSO LAHTHA_APPROVED.
 */
export async function stepUpMfa(deps: IamDeps, session: Session, idToken: string): Promise<SessionView> {
  let claims;
  try {
    claims = await deps.mfa.verify(idToken);
  } catch (err) {
    deps.logger.warn(
      { event: 'MFA_FAILED', vendorId: session.vendorId, sessionId: session.sessionId },
      'mfa verification failed',
    );
    throw err instanceof MfaVerificationError ? err : new MfaVerificationError('mfa verification failed');
  }

  if (claims.vendorId && claims.vendorId !== session.vendorId) {
    deps.logger.warn(
      { event: 'MFA_FAILED', vendorId: session.vendorId, reason: 'subject_mismatch' },
      'mfa subject mismatch',
    );
    throw new MfaVerificationError('MFA assertion does not match the session vendor');
  }

  const approved = await deps.vendorStatus.isApproved(session.vendorId);
  const scopes = deriveScopes(approved, true);
  await deps.sessions.updateScopesAndMfa(session.sessionId, scopes, true);

  deps.logger.info(
    { event: 'MFA_VERIFIED', vendorId: session.vendorId, sessionId: session.sessionId, elevated: approved },
    'mfa step-up verified',
  );
  return toSessionView({ ...session, scopes, mfaVerified: true });
}

/**
 * Resolve and validate a bearer token into an active session, sliding the idle
 * window. Used by the requireScope middleware on every authenticated request.
 */
export async function authenticate(deps: IamDeps, token: string): Promise<Session> {
  const tokenHash = hashSessionToken(token);
  const session = await deps.sessions.findByTokenHash(tokenHash);
  if (!session) throw new SessionInvalidError('not_found');

  const now = deps.clock.now();
  const validity = sessionValidity(session, now);
  if (validity !== 'active') throw new SessionInvalidError(validity);

  const slid = slideIdleExpiry(session, now);
  await deps.sessions.touchIdleExpiry(session.sessionId, slid);
  return { ...session, idleExpiresAt: slid };
}

/** LogoutUseCase: revoke the current session. */
export async function logout(deps: IamDeps, session: Session): Promise<void> {
  await deps.sessions.revoke(session.sessionId, deps.clock.now());
  deps.logger.info(
    { event: 'LOGOUT', vendorId: session.vendorId, sessionId: session.sessionId },
    'session revoked',
  );
}

// Re-export so consumers don't reach past the use-case module.
export { isSessionActive };
