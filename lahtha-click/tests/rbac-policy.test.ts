import { describe, it, expect } from 'vitest';
import {
  applyUserStatusTransition,
  effectivePermissions,
  hasPermission,
  InvalidUserStatusTransition,
  isPermissionId,
  isRoleGrantableTo,
  isRoleId,
  listRoleCatalog,
  ROLES,
  USER_STATUS_ACTIONS,
} from '../src/domains/iam/rbac/rbac-policy.js';

describe('RBAC policy catalog', () => {
  it('every role references only known permissions', () => {
    for (const def of Object.values(ROLES)) {
      for (const perm of def.permissions) expect(isPermissionId(perm)).toBe(true);
    }
  });

  it('exposes the seed catalog', () => {
    const catalog = listRoleCatalog();
    expect(catalog.find((r) => r.roleId === 'vendor.owner')).toBeDefined();
    expect(catalog.length).toBe(Object.keys(ROLES).length);
  });

  it('recognises valid role and permission ids', () => {
    expect(isRoleId('admin.ops')).toBe(true);
    expect(isRoleId('nope.role')).toBe(false);
    expect(isPermissionId('platform.read_all')).toBe(true);
    expect(isPermissionId('platform.read_none')).toBe(false);
  });
});

describe('effective permissions', () => {
  it('unions permissions across granted roles for an active user', () => {
    const perms = effectivePermissions(['vendor.owner', 'vendor.warehouse_manager'], 'active');
    expect(perms.has('lahtha.vendor.manage_profile')).toBe(true);
    expect(perms.has('lahtha.device.register')).toBe(true);
  });

  it('grants NOTHING to a non-active user regardless of roles', () => {
    for (const status of ['pending_kyc', 'suspended', 'revoked'] as const) {
      expect(effectivePermissions(['admin.compliance'], status).size).toBe(0);
    }
  });

  it('ignores unknown role ids', () => {
    expect(effectivePermissions(['ghost.role'], 'active').size).toBe(0);
  });

  it('hasPermission reflects the effective set', () => {
    expect(hasPermission(['admin.support'], 'active', 'platform.read_all')).toBe(true);
    expect(hasPermission(['admin.support'], 'active', 'platform.pii.read')).toBe(false);
    expect(hasPermission(['admin.support'], 'suspended', 'platform.read_all')).toBe(false);
  });
});

describe('role grantability (principal/role coherence)', () => {
  it('allows a role only for its matching principal type', () => {
    expect(isRoleGrantableTo('vendor', 'vendor.owner')).toBe(true);
    expect(isRoleGrantableTo('customer', 'vendor.owner')).toBe(false);
    expect(isRoleGrantableTo('admin', 'admin.ops')).toBe(true);
  });

  it('never grants interactive roles to a service principal', () => {
    expect(isRoleGrantableTo('service', 'admin.ops')).toBe(false);
  });
});

describe('user status state machine', () => {
  it('activates a pending user', () => {
    expect(applyUserStatusTransition('pending_kyc', USER_STATUS_ACTIONS.ACTIVATE)).toBe('active');
  });
  it('suspends and reinstates', () => {
    expect(applyUserStatusTransition('active', USER_STATUS_ACTIONS.SUSPEND)).toBe('suspended');
    expect(applyUserStatusTransition('suspended', USER_STATUS_ACTIONS.REINSTATE)).toBe('active');
  });
  it('revokes from any non-terminal state', () => {
    for (const s of ['pending_kyc', 'active', 'suspended'] as const) {
      expect(applyUserStatusTransition(s, USER_STATUS_ACTIONS.REVOKE)).toBe('revoked');
    }
  });
  it('rejects illegal transitions', () => {
    expect(() => applyUserStatusTransition('revoked', USER_STATUS_ACTIONS.ACTIVATE)).toThrow(
      InvalidUserStatusTransition,
    );
    expect(() => applyUserStatusTransition('pending_kyc', USER_STATUS_ACTIONS.SUSPEND)).toThrow(
      InvalidUserStatusTransition,
    );
  });
});
