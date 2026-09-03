// RBAC service — orchestrates persons, users (principals), role grants and the
// authorization check, over ports. No HTTP / Mongoose knowledge here.

import { createHmac, randomUUID } from 'node:crypto';
import {
  applyUserStatusTransition,
  effectivePermissions,
  isRoleGrantableTo,
  isRoleId,
  type PermissionId,
  type PrincipalType,
  type RoleId,
  type UserStatus,
  type UserStatusAction,
} from './rbac-policy.js';
import type {
  AccessAuditRepository,
  OidcIdentityLinkRepository,
  Person,
  PersonRepository,
  RoleGrantRepository,
  User,
  UserRepository,
} from './rbac-types.js';
import type { AuditLogger, Clock } from '../types.js';

export interface RbacDeps {
  persons: PersonRepository;
  users: UserRepository;
  grants: RoleGrantRepository;
  audit: AccessAuditRepository;
  clock: Clock;
  logger: AuditLogger;
  /** Pepper for hashing national ids before storage. */
  piiPepper: string;
  /**
   * Optional: OIDC (issuer, subject) -> principal linking, for SSO bearer
   * authentication. Omitted in most tests and in any deployment that hasn't
   * configured an OIDC IdP — resolveOidcPrincipal then always returns null
   * (fails closed) and linkOidcIdentity/unlinkOidcIdentity throw
   * OidcNotConfiguredError.
   */
  oidcLinks?: OidcIdentityLinkRepository;
}

// --- Errors ---
export class PersonNotFoundError extends Error {
  constructor(public readonly personId: string) {
    super(`Person ${personId} not found`);
    this.name = 'PersonNotFoundError';
  }
}
export class UserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`User ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}
export class RbacConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'RbacConflictError';
  }
}
export class RoleNotGrantableError extends Error {
  constructor(public readonly roleId: string, public readonly principalType: string) {
    super(`Role "${roleId}" is not grantable to a ${principalType} principal`);
    this.name = 'RoleNotGrantableError';
  }
}
export class UnknownRoleError extends Error {
  constructor(public readonly roleId: string) {
    super(`Unknown role "${roleId}"`);
    this.name = 'UnknownRoleError';
  }
}
export class OidcNotConfiguredError extends Error {
  constructor() {
    super('OIDC identity linking is not configured for this RBAC service');
    this.name = 'OidcNotConfiguredError';
  }
}

export interface CreatePersonInput {
  fullName: string;
  primaryPhone: string;
  nationalId?: string;
}

export interface UserView {
  user: User;
  roles: string[];
  permissions: PermissionId[];
}

export interface PermissionCheckContext {
  actorUserId: string;
  permission: PermissionId;
  resourceRef?: string | null;
  actedOnUserId?: string | null;
  correlationId?: string | null;
  sourceIp?: string | null;
  userAgent?: string | null;
}

export interface PermissionCheckResult {
  allowed: boolean;
  /** Present when the actor resolves to a user. */
  status?: UserStatus;
  reason: 'allowed' | 'actor_not_found' | 'missing_permission';
}

export class RbacService {
  constructor(private readonly deps: RbacDeps) {}

  private hashNationalId(nationalId: string): string {
    return createHmac('sha256', this.deps.piiPepper).update(nationalId).digest('hex');
  }

  async createPerson(input: CreatePersonInput): Promise<Person> {
    const existing = await this.deps.persons.findByPhone(input.primaryPhone);
    if (existing) throw new RbacConflictError(`phone ${input.primaryPhone} already registered`);
    const person: Person = {
      personId: randomUUID(),
      fullName: input.fullName,
      nationalIdHash: input.nationalId ? this.hashNationalId(input.nationalId) : null,
      primaryPhone: input.primaryPhone,
      createdAt: this.deps.clock.now(),
    };
    await this.deps.persons.create(person);
    this.deps.logger.info({ event: 'PERSON_CREATED', personId: person.personId }, 'person created');
    return person;
  }

  /** Create a principal (user) for a person. Enforces one user per (person, type). */
  async createUser(personId: string, principalType: PrincipalType): Promise<User> {
    const person = await this.deps.persons.findById(personId);
    if (!person) throw new PersonNotFoundError(personId);
    const dupe = await this.deps.users.findByPersonAndType(personId, principalType);
    if (dupe) throw new RbacConflictError(`person already has a ${principalType} principal`);

    const user: User = {
      userId: randomUUID(),
      personId,
      principalType,
      status: 'pending_kyc',
      createdAt: this.deps.clock.now(),
    };
    await this.deps.users.create(user);
    this.deps.logger.info(
      { event: 'USER_CREATED', userId: user.userId, personId, principalType },
      'principal created',
    );
    return user;
  }

  async setUserStatus(userId: string, action: UserStatusAction): Promise<User> {
    const user = await this.requireUser(userId);
    const next = applyUserStatusTransition(user.status, action); // throws on illegal transition
    await this.deps.users.updateStatus(userId, next);
    this.deps.logger.info(
      { event: 'USER_STATUS_CHANGED', userId, from: user.status, to: next, action },
      'user status changed',
    );
    return { ...user, status: next };
  }

  async grantRole(userId: string, roleId: string, grantedBy: string): Promise<void> {
    const user = await this.requireUser(userId);
    if (!isRoleId(roleId)) throw new UnknownRoleError(roleId);
    if (!isRoleGrantableTo(user.principalType, roleId)) {
      throw new RoleNotGrantableError(roleId, user.principalType);
    }
    if (await this.deps.grants.hasGrant(userId, roleId)) return; // idempotent
    await this.deps.grants.grant({
      userId,
      roleId,
      grantedAt: this.deps.clock.now(),
      grantedBy,
    });
    this.deps.logger.info({ event: 'ROLE_GRANTED', userId, roleId, grantedBy }, 'role granted');
  }

  async revokeRole(userId: string, roleId: string, revokedBy: string): Promise<void> {
    await this.requireUser(userId);
    const removed = await this.deps.grants.revoke(userId, roleId);
    if (removed) {
      this.deps.logger.info({ event: 'ROLE_REVOKED', userId, roleId, revokedBy }, 'role revoked');
    }
  }

  async getUserView(userId: string): Promise<UserView> {
    const user = await this.requireUser(userId);
    const roles = await this.deps.grants.listForUser(userId);
    const permissions = [...effectivePermissions(roles, user.status)];
    return { user, roles, permissions };
  }

  /** Admin listing of users (with their roles), optionally filtered. */
  async listUsers(filter: { principalType?: PrincipalType; status?: UserStatus; limit?: number }): Promise<UserView[]> {
    const users = await this.deps.users.list(filter);
    return Promise.all(
      users.map(async (user) => {
        const roles = await this.deps.grants.listForUser(user.userId);
        return { user, roles, permissions: [...effectivePermissions(roles, user.status)] };
      }),
    );
  }

  /**
   * Find-or-create a person (keyed by phone) and their principal of the given
   * type. Idempotent — the bridge calls this to link a vendor identity to an
   * RBAC user without duplicating either.
   */
  async provisionPrincipal(input: {
    fullName: string;
    primaryPhone: string;
    nationalId?: string;
    principalType: PrincipalType;
  }): Promise<{ personId: string; userId: string }> {
    let person = await this.deps.persons.findByPhone(input.primaryPhone);
    if (!person) {
      person = await this.createPerson({
        fullName: input.fullName,
        primaryPhone: input.primaryPhone,
        ...(input.nationalId ? { nationalId: input.nationalId } : {}),
      });
    }
    let user = await this.deps.users.findByPersonAndType(person.personId, input.principalType);
    if (!user) {
      user = await this.createUser(person.personId, input.principalType);
    }
    return { personId: person.personId, userId: user.userId };
  }

  /**
   * Authorization decision for an actor + permission, recorded in access_audit.
   * A missing actor or insufficient permission both yield a denied (audited) result.
   */
  async checkPermission(ctx: PermissionCheckContext): Promise<PermissionCheckResult> {
    const actor = await this.deps.users.findById(ctx.actorUserId);
    let allowed = false;
    let reason: PermissionCheckResult['reason'] = 'actor_not_found';
    let status: UserStatus | undefined;

    if (actor) {
      status = actor.status;
      const roles = await this.deps.grants.listForUser(actor.userId);
      allowed = effectivePermissions(roles, actor.status).has(ctx.permission);
      reason = allowed ? 'allowed' : 'missing_permission';
    }

    await this.deps.audit.append({
      auditId: randomUUID(),
      occurredAt: this.deps.clock.now(),
      actorUserId: ctx.actorUserId,
      actedOnUserId: ctx.actedOnUserId ?? null,
      permissionId: ctx.permission,
      decision: allowed ? 'allow' : 'deny',
      resourceRef: ctx.resourceRef ?? null,
      correlationId: ctx.correlationId ?? null,
      sourceIp: ctx.sourceIp ?? null,
      userAgent: ctx.userAgent ?? null,
    });

    return { allowed, reason, ...(status ? { status } : {}) };
  }

  async listAccessAudit(filter: { actorUserId?: string; actedOnUserId?: string; limit?: number }) {
    return this.deps.audit.list(filter);
  }

  /**
   * Link a verified OIDC (issuer, subject) pair to an existing RBAC user, so
   * that user's future SSO logins resolve to this principal. Idempotent for
   * the same user; conflicts if the subject is already linked elsewhere.
   * Always an explicit admin action (never JIT/auto-provisioned) — an `admin`
   * principal is hard-provisioned per docs/architecture/iam-rbac.md, so an
   * unrecognized SSO subject must not silently become a new account.
   */
  async linkOidcIdentity(userId: string, issuer: string, subject: string, linkedBy: string): Promise<void> {
    if (!this.deps.oidcLinks) throw new OidcNotConfiguredError();
    const user = await this.requireUser(userId);
    const existing = await this.deps.oidcLinks.findByIssuerSubject(issuer, subject);
    if (existing && existing.userId !== user.userId) {
      throw new RbacConflictError(`OIDC subject is already linked to a different user`);
    }
    if (existing) return; // idempotent
    await this.deps.oidcLinks.link({
      issuer,
      subject,
      userId: user.userId,
      linkedAt: this.deps.clock.now(),
      linkedBy,
    });
    this.deps.logger.info({ event: 'OIDC_IDENTITY_LINKED', userId, issuer }, 'oidc identity linked');
  }

  async unlinkOidcIdentity(issuer: string, subject: string): Promise<boolean> {
    if (!this.deps.oidcLinks) throw new OidcNotConfiguredError();
    return this.deps.oidcLinks.unlink(issuer, subject);
  }

  /**
   * Resolve the RBAC principal for a verified OIDC (issuer, subject) pair.
   * Returns null (never throws) when unlinked or when OIDC linking isn't
   * configured — this is the fail-closed path the OIDC bearer-auth middleware
   * relies on: an unresolved principal simply falls through to session auth.
   */
  async resolveOidcPrincipal(issuer: string, subject: string): Promise<User | null> {
    if (!this.deps.oidcLinks) return null;
    const link = await this.deps.oidcLinks.findByIssuerSubject(issuer, subject);
    if (!link) return null;
    return this.deps.users.findById(link.userId);
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw new UserNotFoundError(userId);
    return user;
  }
}
