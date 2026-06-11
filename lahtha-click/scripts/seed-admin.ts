// One-time admin bootstrap (Phase 1). Creates (or reuses) an admin person +
// principal, grants an admin role, and creates a vendor_identities record keyed
// by email so the admin can log in via the existing email-OTP flow
// (/iam/auth/otp/request-by-email + verify-by-email). No new auth endpoint.
//
// Usage:
//   tsx scripts/seed-admin.ts <email> <phone> [fullName] [roleId]
// e.g.
//   tsx scripts/seed-admin.ts admin@lahtha.sa +966500000000 "Platform Admin" admin.compliance
//
// Admins are NOT self-service — this is an operator-run bootstrap (Phase 2 moves
// to enterprise SSO, per docs/architecture/iam-rbac.md).

import { randomUUID } from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../src/lib/db.js';
import { loadConfig } from '../src/config/index.js';
import { logger } from '../src/lib/logger.js';
import { SystemClock } from '../src/domains/iam/in-memory-adapters.js';
import { MongoVendorIdentityRepository } from '../src/domains/iam/mongo-adapters.js';
import { RbacService } from '../src/domains/iam/rbac/rbac.service.js';
import { isRoleId } from '../src/domains/iam/rbac/rbac-policy.js';
import {
  MongoAccessAuditRepository,
  MongoPersonRepository,
  MongoRoleGrantRepository,
  MongoUserRepository,
} from '../src/domains/iam/rbac/rbac.mongo.js';

async function main(): Promise<void> {
  const [, , email, phone, fullName = 'Platform Admin', roleId = 'admin.compliance'] = process.argv;
  if (!email || !phone) {
    console.error('usage: tsx scripts/seed-admin.ts <email> <phone> [fullName] [roleId]');
    process.exit(2);
  }
  if (!isRoleId(roleId) || !roleId.startsWith('admin.')) {
    console.error(`roleId must be an admin.* role (got "${roleId}")`);
    process.exit(2);
  }

  const cfg = loadConfig();
  await connectDatabase();
  try {
    const rbac = new RbacService({
      persons: new MongoPersonRepository(),
      users: new MongoUserRepository(),
      grants: new MongoRoleGrantRepository(),
      audit: new MongoAccessAuditRepository(),
      clock: new SystemClock(),
      logger,
      piiPepper: cfg.IAM_OTP_PEPPER,
    });

    const { personId, userId } = await rbac.provisionPrincipal({
      fullName,
      primaryPhone: phone,
      principalType: 'admin',
    });

    const view = await rbac.getUserView(userId);
    if (view.user.status === 'pending_kyc') await rbac.setUserStatus(userId, 'ACTIVATE');
    await rbac.grantRole(userId, roleId, 'seed-admin');

    // Identity record so email-OTP login resolves this admin.
    const identities = new MongoVendorIdentityRepository();
    const existing = await identities.findByEmail(email.toLowerCase());
    if (!existing) {
      await identities.create({
        vendorId: randomUUID(),
        businessName: fullName,
        email: email.toLowerCase(),
        phone,
        personId,
        userId,
        createdAt: new Date(),
      });
    }

    console.log(`Admin ready: userId=${userId} personId=${personId} role=${roleId} email=${email}`);
    console.log('Log in via the email-OTP flow (/iam/auth/otp/request-by-email + verify-by-email).');
  } finally {
    await disconnectDatabase();
  }
}

void main().catch((err) => {
  console.error('seed-admin failed:', err);
  process.exit(1);
});
