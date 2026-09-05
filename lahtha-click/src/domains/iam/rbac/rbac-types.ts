// RBAC entities and ports. Use cases/service depend on these interfaces only.

import type { PrincipalType, UserStatus } from './rbac-policy.js';

export interface Person {
  personId: string;
  fullName: string;
  /** HMAC/hash of the national id — the raw value is never stored. */
  nationalIdHash: string | null;
  primaryPhone: string;
  createdAt: Date;
}

export interface User {
  userId: string;
  personId: string;
  principalType: PrincipalType;
  status: UserStatus;
  createdAt: Date;
}

export interface RoleGrant {
  userId: string;
  roleId: string;
  grantedAt: Date;
  grantedBy: string;
}

export type AccessDecision = 'allow' | 'deny';

export interface AccessAuditEntry {
  auditId: string;
  occurredAt: Date;
  actorUserId: string;
  actedOnUserId: string | null;
  permissionId: string;
  decision: AccessDecision;
  resourceRef: string | null;
  correlationId: string | null;
  sourceIp: string | null;
  userAgent: string | null;
}

export interface PersonRepository {
  create(person: Person): Promise<Person>;
  findById(personId: string): Promise<Person | null>;
  findByPhone(primaryPhone: string): Promise<Person | null>;
}

export interface UserRepository {
  create(user: User): Promise<User>;
  findById(userId: string): Promise<User | null>;
  findByPersonAndType(personId: string, principalType: PrincipalType): Promise<User | null>;
  listByPerson(personId: string): Promise<User[]>;
  /** Admin listing, optionally filtered by principal type and/or status. */
  list(filter: { principalType?: PrincipalType; status?: UserStatus; limit?: number }): Promise<User[]>;
  updateStatus(userId: string, status: UserStatus): Promise<void>;
}

export interface RoleGrantRepository {
  grant(grant: RoleGrant): Promise<void>;
  revoke(userId: string, roleId: string): Promise<boolean>;
  listForUser(userId: string): Promise<string[]>;
  hasGrant(userId: string, roleId: string): Promise<boolean>;
}

export interface AccessAuditRepository {
  append(entry: AccessAuditEntry): Promise<void>;
  list(filter: { actorUserId?: string; actedOnUserId?: string; limit?: number }): Promise<AccessAuditEntry[]>;
}

/**
 * Links a verified OIDC (issuer, subject) pair to an RBAC principal, for SSO
 * bearer authentication. Never created automatically — an admin links it
 * explicitly (platform.iam.manage), matching the `admin` principal being
 * hard-provisioned, SSO-only (docs/architecture/iam-rbac.md).
 */
export interface OidcIdentityLink {
  issuer: string;
  subject: string;
  userId: string;
  linkedAt: Date;
  linkedBy: string;
}

export interface OidcIdentityLinkRepository {
  link(link: OidcIdentityLink): Promise<void>;
  findByIssuerSubject(issuer: string, subject: string): Promise<OidcIdentityLink | null>;
  unlink(issuer: string, subject: string): Promise<boolean>;
}
