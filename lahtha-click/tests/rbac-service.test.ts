import { describe, it, expect, beforeEach } from 'vitest';
import {
  OidcNotConfiguredError,
  PersonNotFoundError,
  RbacConflictError,
  RbacService,
  RoleNotGrantableError,
  UnknownRoleError,
  UserNotFoundError,
} from '../src/domains/iam/rbac/rbac.service.js';
import { InvalidUserStatusTransition, USER_STATUS_ACTIONS } from '../src/domains/iam/rbac/rbac-policy.js';
import {
  InMemoryAccessAuditRepository,
  InMemoryOidcIdentityLinkRepository,
  InMemoryPersonRepository,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from '../src/domains/iam/rbac/rbac.in-memory.js';
import { FixedClock } from '../src/domains/iam/in-memory-adapters.js';

const silentLogger = { info: () => {}, warn: () => {} };

function build() {
  const audit = new InMemoryAccessAuditRepository();
  const service = new RbacService({
    persons: new InMemoryPersonRepository(),
    users: new InMemoryUserRepository(),
    grants: new InMemoryRoleGrantRepository(),
    audit,
    clock: new FixedClock(new Date('2026-06-05T00:00:00Z')),
    logger: silentLogger,
    piiPepper: 'test-pii-pepper',
  });
  return { service, audit };
}

async function activeVendorUser(service: RbacService) {
  const person = await service.createPerson({ fullName: 'Sara A', primaryPhone: '+966500000001' });
  const user = await service.createUser(person.personId, 'vendor');
  await service.setUserStatus(user.userId, USER_STATUS_ACTIONS.ACTIVATE);
  return user;
}

describe('RbacService', () => {
  let service: RbacService;
  let audit: InMemoryAccessAuditRepository;

  beforeEach(() => {
    const built = build();
    service = built.service;
    audit = built.audit;
  });

  it('creates a person and rejects duplicate phones', async () => {
    await service.createPerson({ fullName: 'Sara', primaryPhone: '+966500000001' });
    await expect(
      service.createPerson({ fullName: 'Other', primaryPhone: '+966500000001' }),
    ).rejects.toBeInstanceOf(RbacConflictError);
  });

  it('hashes the national id instead of storing it raw', async () => {
    const person = await service.createPerson({
      fullName: 'Sara',
      primaryPhone: '+966500000002',
      nationalId: '1234567890',
    });
    expect(person.nationalIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(person.nationalIdHash).not.toContain('1234567890');
  });

  it('supports multi-principal linkage but blocks duplicate principals', async () => {
    const person = await service.createPerson({ fullName: 'Sara', primaryPhone: '+966500000003' });
    await service.createUser(person.personId, 'vendor');
    await service.createUser(person.personId, 'dealer'); // same human, second principal — OK
    await expect(service.createUser(person.personId, 'vendor')).rejects.toBeInstanceOf(
      RbacConflictError,
    );
  });

  it('rejects creating a user for an unknown person', async () => {
    await expect(service.createUser('nope', 'vendor')).rejects.toBeInstanceOf(PersonNotFoundError);
  });

  it('grants a role coherent with the principal and exposes its permissions', async () => {
    const user = await activeVendorUser(service);
    await service.grantRole(user.userId, 'vendor.owner', 'admin-1');
    const view = await service.getUserView(user.userId);
    expect(view.roles).toContain('vendor.owner');
    expect(view.permissions).toContain('lahtha.vendor.manage_profile');
  });

  it('refuses to grant a role to an incompatible principal', async () => {
    const user = await activeVendorUser(service);
    await expect(service.grantRole(user.userId, 'admin.ops', 'admin-1')).rejects.toBeInstanceOf(
      RoleNotGrantableError,
    );
  });

  it('refuses unknown roles', async () => {
    const user = await activeVendorUser(service);
    await expect(service.grantRole(user.userId, 'ghost.role', 'admin-1')).rejects.toBeInstanceOf(
      UnknownRoleError,
    );
  });

  it('grant is idempotent and revoke removes the grant', async () => {
    const user = await activeVendorUser(service);
    await service.grantRole(user.userId, 'vendor.owner', 'admin-1');
    await service.grantRole(user.userId, 'vendor.owner', 'admin-1');
    let view = await service.getUserView(user.userId);
    expect(view.roles.filter((r) => r === 'vendor.owner')).toHaveLength(1);
    await service.revokeRole(user.userId, 'vendor.owner', 'admin-1');
    view = await service.getUserView(user.userId);
    expect(view.roles).not.toContain('vendor.owner');
  });

  it('enforces the user status state machine', async () => {
    const person = await service.createPerson({ fullName: 'Sara', primaryPhone: '+966500000009' });
    const user = await service.createUser(person.personId, 'vendor');
    await expect(service.setUserStatus(user.userId, USER_STATUS_ACTIONS.SUSPEND)).rejects.toBeInstanceOf(
      InvalidUserStatusTransition,
    );
  });

  it('setUserStatus 404s on unknown users', async () => {
    await expect(service.setUserStatus('nope', USER_STATUS_ACTIONS.ACTIVATE)).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  describe('checkPermission + access_audit', () => {
    it('allows an active user holding the permission and audits the allow', async () => {
      const user = await activeVendorUser(service);
      await service.grantRole(user.userId, 'vendor.owner', 'admin-1');
      const result = await service.checkPermission({
        actorUserId: user.userId,
        permission: 'lahtha.vendor.manage_profile',
      });
      expect(result.allowed).toBe(true);
      const log = await service.listAccessAudit({ actorUserId: user.userId });
      expect(log[0]?.decision).toBe('allow');
    });

    it('denies (and audits) when the permission is missing', async () => {
      const user = await activeVendorUser(service);
      const result = await service.checkPermission({
        actorUserId: user.userId,
        permission: 'platform.pii.read',
      });
      expect(result).toMatchObject({ allowed: false, reason: 'missing_permission' });
      expect(audit.entries.at(-1)?.decision).toBe('deny');
    });

    it('denies a suspended user even with a matching role', async () => {
      const user = await activeVendorUser(service);
      await service.grantRole(user.userId, 'vendor.owner', 'admin-1');
      await service.setUserStatus(user.userId, USER_STATUS_ACTIONS.SUSPEND);
      const result = await service.checkPermission({
        actorUserId: user.userId,
        permission: 'lahtha.vendor.manage_profile',
      });
      expect(result.allowed).toBe(false);
    });

    it('denies and audits an unknown actor', async () => {
      const result = await service.checkPermission({
        actorUserId: 'ghost',
        permission: 'platform.read_all',
      });
      expect(result).toMatchObject({ allowed: false, reason: 'actor_not_found' });
      expect(audit.entries.at(-1)).toMatchObject({ actorUserId: 'ghost', decision: 'deny' });
    });
  });

  describe('OIDC identity linking (SSO bearer auth)', () => {
    it('throws OidcNotConfiguredError when the service has no oidcLinks repository', async () => {
      // `service` from the top-level build() intentionally omits oidcLinks —
      // most tests (and most deployments without an OIDC IdP) never need it.
      const user = await activeVendorUser(service);
      await expect(service.linkOidcIdentity(user.userId, 'https://idp.test', 'sub-1', 'admin-1')).rejects.toBeInstanceOf(
        OidcNotConfiguredError,
      );
      await expect(service.resolveOidcPrincipal('https://idp.test', 'sub-1')).resolves.toBeNull();
      await expect(service.unlinkOidcIdentity('https://idp.test', 'sub-1')).rejects.toBeInstanceOf(
        OidcNotConfiguredError,
      );
    });

    function buildWithOidc() {
      const audit = new InMemoryAccessAuditRepository();
      const service = new RbacService({
        persons: new InMemoryPersonRepository(),
        users: new InMemoryUserRepository(),
        grants: new InMemoryRoleGrantRepository(),
        audit,
        oidcLinks: new InMemoryOidcIdentityLinkRepository(),
        clock: new FixedClock(new Date('2026-06-05T00:00:00Z')),
        logger: silentLogger,
        piiPepper: 'test-pii-pepper',
      });
      return service;
    }

    it('links an OIDC subject to a user and resolves it back', async () => {
      const service = buildWithOidc();
      const user = await activeVendorUser(service);
      await service.linkOidcIdentity(user.userId, 'https://idp.test', 'sub-1', 'admin-1');
      const resolved = await service.resolveOidcPrincipal('https://idp.test', 'sub-1');
      expect(resolved?.userId).toBe(user.userId);
    });

    it('returns null for an unlinked (issuer, subject) pair', async () => {
      const service = buildWithOidc();
      await expect(service.resolveOidcPrincipal('https://idp.test', 'nobody')).resolves.toBeNull();
    });

    it('linking is idempotent for the same user', async () => {
      const service = buildWithOidc();
      const user = await activeVendorUser(service);
      await service.linkOidcIdentity(user.userId, 'https://idp.test', 'sub-1', 'admin-1');
      await service.linkOidcIdentity(user.userId, 'https://idp.test', 'sub-1', 'admin-1');
      const resolved = await service.resolveOidcPrincipal('https://idp.test', 'sub-1');
      expect(resolved?.userId).toBe(user.userId);
    });

    it('refuses to relink a subject already linked to a different user', async () => {
      const service = buildWithOidc();
      const userA = await activeVendorUser(service);
      const person = await service.createPerson({ fullName: 'Other', primaryPhone: '+966500000099' });
      const userB = await service.createUser(person.personId, 'vendor');
      await service.linkOidcIdentity(userA.userId, 'https://idp.test', 'sub-1', 'admin-1');
      await expect(
        service.linkOidcIdentity(userB.userId, 'https://idp.test', 'sub-1', 'admin-1'),
      ).rejects.toBeInstanceOf(RbacConflictError);
    });

    it('404s linking to an unknown user', async () => {
      const service = buildWithOidc();
      await expect(
        service.linkOidcIdentity('ghost', 'https://idp.test', 'sub-1', 'admin-1'),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });

    it('unlink removes the link and resolveOidcPrincipal reverts to null', async () => {
      const service = buildWithOidc();
      const user = await activeVendorUser(service);
      await service.linkOidcIdentity(user.userId, 'https://idp.test', 'sub-1', 'admin-1');
      const removed = await service.unlinkOidcIdentity('https://idp.test', 'sub-1');
      expect(removed).toBe(true);
      await expect(service.resolveOidcPrincipal('https://idp.test', 'sub-1')).resolves.toBeNull();
    });

    it('unlink of a non-existent link returns false', async () => {
      const service = buildWithOidc();
      await expect(service.unlinkOidcIdentity('https://idp.test', 'nobody')).resolves.toBe(false);
    });
  });
});
