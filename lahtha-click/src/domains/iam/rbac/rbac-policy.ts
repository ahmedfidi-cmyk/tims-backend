// RBAC policy — pure, in-code source of truth for roles & permissions.
//
// Per docs/architecture/iam-rbac.md the Phase-1 role/permission catalog is small
// and fixed, so it lives in code (fails the build if a role references an unknown
// permission). Dynamic state — persons, users (principals), and role grants —
// lives in the database; this module never touches I/O.

export const DOMAINS = ['lahtha', 'click', 'platform'] as const;
export type Domain = (typeof DOMAINS)[number];

export const PRINCIPAL_TYPES = ['customer', 'vendor', 'dealer', 'admin', 'service'] as const;
export type PrincipalType = (typeof PRINCIPAL_TYPES)[number];

export const USER_STATUSES = ['pending_kyc', 'active', 'suspended', 'revoked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

// --- Permission catalog ({domain}.{resource}.{action}) ---

export const PERMISSIONS = {
  'lahtha.order.place': 'Place a LAHTHA order',
  'lahtha.invoice.view_own': 'View own invoices',
  'lahtha.vendor.manage_profile': 'Manage vendor profile',
  'lahtha.device.list': 'List devices',
  'lahtha.device.register': 'Register an IMEI device',
  'lahtha.document.upload': 'Upload ownership/KYC documents',
  'lahtha.document.review': 'Review (download) device documents (compliance)',
  'lahtha.device.audit': 'Browse all registered devices (admin oversight)',
  'lahtha.payout.view': 'View payouts',
  'lahtha.order.refund': 'Issue an order refund',
  'lahtha.order.fulfill': 'Ship a sold order (selling vendor)',
  'lahtha.state.override': 'Override a state machine (ops)',
  'click.dealer.manage_profile': 'Manage dealer profile',
  'click.wallet.topup': 'Top up a CLICK wallet',
  'click.wallet.withdraw': 'Withdraw from a CLICK wallet',
  'click.auction.bid': 'Place auction bids',
  'click.auction.close': 'Close an auction',
  'platform.read_all': 'Read-only access across both domains',
  'platform.user.suspend': 'Suspend a user',
  'platform.pii.read': 'Read PII (national id, etc.)',
  'platform.audit.read': 'Read audit logs',
  'platform.vendor.review': 'Approve or reject vendors (admin)',
  'platform.iam.manage': 'Grant/revoke roles and change user status (admin)',
} as const;

export type PermissionId = keyof typeof PERMISSIONS;

export function isPermissionId(value: string): value is PermissionId {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

// --- Role catalog (seed roles, Phase 1) ---

export interface RoleDefinition {
  domain: Domain;
  description: string;
  permissions: readonly PermissionId[];
}

export const ROLES = {
  'customer.standard': {
    domain: 'lahtha',
    description: 'Place orders, view own invoices',
    permissions: ['lahtha.order.place', 'lahtha.invoice.view_own'],
  },
  'vendor.owner': {
    domain: 'lahtha',
    description: 'Full self-serve vendor: profile, devices (register + list), docs, payouts',
    permissions: [
      'lahtha.vendor.manage_profile',
      'lahtha.device.list',
      'lahtha.device.register',
      'lahtha.document.upload',
      'lahtha.payout.view',
      'lahtha.order.fulfill',
    ],
  },
  'vendor.warehouse_manager': {
    domain: 'lahtha',
    description: 'Register IMEI, upload docs, ship orders (cannot change payout)',
    permissions: [
      'lahtha.device.register',
      'lahtha.document.upload',
      'lahtha.device.list',
      'lahtha.order.fulfill',
    ],
  },
  'dealer.owner': {
    domain: 'click',
    description: 'Manage dealer profile, top up wallet, bid',
    permissions: [
      'click.dealer.manage_profile',
      'click.wallet.topup',
      'click.wallet.withdraw',
      'click.auction.bid',
    ],
  },
  'dealer.bidder': {
    domain: 'click',
    description: 'Place bids only (cannot withdraw funds)',
    permissions: ['click.auction.bid'],
  },
  'admin.support': {
    domain: 'platform',
    description: 'Read-only across both domains',
    permissions: ['platform.read_all', 'lahtha.device.audit'],
  },
  'admin.ops': {
    domain: 'platform',
    description: 'Issue refunds, override states, suspend users, review vendors, manage IAM',
    permissions: [
      'lahtha.order.refund',
      'lahtha.state.override',
      'lahtha.document.review',
      'lahtha.device.audit',
      'click.auction.close',
      'platform.user.suspend',
      'platform.vendor.review',
      'platform.iam.manage',
    ],
  },
  'admin.compliance': {
    domain: 'platform',
    description: 'Access PII and audit logs, review vendors and documents',
    permissions: [
      'platform.pii.read',
      'platform.audit.read',
      'platform.read_all',
      'platform.vendor.review',
      'lahtha.document.review',
      'lahtha.device.audit',
    ],
  },
} as const satisfies Record<string, RoleDefinition>;

export type RoleId = keyof typeof ROLES;

export function isRoleId(value: string): value is RoleId {
  return Object.prototype.hasOwnProperty.call(ROLES, value);
}

// Fail fast at module load: every role permission must exist in the catalog.
(function enforceCatalogIntegrity(): void {
  for (const [roleId, def] of Object.entries(ROLES) as Array<[RoleId, RoleDefinition]>) {
    for (const perm of def.permissions) {
      if (!isPermissionId(perm)) {
        throw new Error(`Role "${roleId}" references unknown permission "${perm}"`);
      }
    }
  }
})();

/**
 * A role is grantable to a principal only when the role's group matches the
 * principal type (e.g. only a `vendor` user may hold `vendor.*`). `service`
 * principals hold no interactive roles.
 */
export function isRoleGrantableTo(principalType: PrincipalType, roleId: RoleId): boolean {
  if (principalType === 'service') return false;
  return roleId.startsWith(`${principalType}.`);
}

/**
 * Effective permissions for a user. A non-active user (pending KYC, suspended,
 * revoked) has NO effective permissions, regardless of granted roles.
 */
export function effectivePermissions(roleIds: readonly string[], status: UserStatus): Set<PermissionId> {
  const perms = new Set<PermissionId>();
  if (status !== 'active') return perms;
  for (const roleId of roleIds) {
    if (!isRoleId(roleId)) continue;
    for (const p of ROLES[roleId].permissions) perms.add(p);
  }
  return perms;
}

export function hasPermission(
  roleIds: readonly string[],
  status: UserStatus,
  required: PermissionId,
): boolean {
  return effectivePermissions(roleIds, status).has(required);
}

// --- User status state machine ---

export const USER_STATUS_ACTIONS = {
  ACTIVATE: 'ACTIVATE',
  SUSPEND: 'SUSPEND',
  REINSTATE: 'REINSTATE',
  REVOKE: 'REVOKE',
} as const;
export type UserStatusAction = (typeof USER_STATUS_ACTIONS)[keyof typeof USER_STATUS_ACTIONS];

const STATUS_TRANSITIONS: Record<UserStatusAction, { from: readonly UserStatus[]; to: UserStatus }> = {
  ACTIVATE: { from: ['pending_kyc'], to: 'active' },
  REINSTATE: { from: ['suspended'], to: 'active' },
  SUSPEND: { from: ['active'], to: 'suspended' },
  REVOKE: { from: ['pending_kyc', 'active', 'suspended'], to: 'revoked' },
};

export class InvalidUserStatusTransition extends Error {
  constructor(
    public readonly from: UserStatus,
    public readonly action: UserStatusAction,
  ) {
    super(`Cannot ${action} a user in status "${from}"`);
    this.name = 'InvalidUserStatusTransition';
  }
}

export function applyUserStatusTransition(from: UserStatus, action: UserStatusAction): UserStatus {
  const rule = STATUS_TRANSITIONS[action];
  if (!rule.from.includes(from)) throw new InvalidUserStatusTransition(from, action);
  return rule.to;
}

/** Public view of the seed catalog (for GET /iam/roles). */
export function listRoleCatalog(): Array<{ roleId: RoleId; domain: Domain; description: string; permissions: PermissionId[] }> {
  return (Object.entries(ROLES) as Array<[RoleId, RoleDefinition]>).map(([roleId, def]) => ({
    roleId,
    domain: def.domain,
    description: def.description,
    permissions: [...def.permissions],
  }));
}
