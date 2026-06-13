// Public entry point for the vendor-approval domain.
// Wires the Mongo-backed repositories into the service and HTTP router, and the
// cross-domain adapters that link approval to IAM (ADR-0005).

import { Router } from 'express';
import { MongoAuditRepository, MongoVendorRepository } from './mongo-repositories.js';
import { VendorApprovalService } from './vendor.service.js';
import { createVendorRouter } from './vendor.routes.js';
import { logger } from '../../../lib/logger.js';
import type { Authz } from '../../iam/authz.js';
import type { VendorActivationPort } from './types.js';
import type { VendorApprovalProvisioner } from '../../iam/types.js';
import type { RbacService } from '../../iam/rbac/rbac.service.js';

export { VendorApprovalService } from './vendor.service.js';
export { createVendorRouter } from './vendor.routes.js';
export * from './vendor-approval.js';
export type * from './types.js';

/**
 * vendor-approval → RBAC activation: on approval, activate the linked user and
 * grant the default vendor role (both idempotent). Best-effort at the caller.
 */
export class RbacVendorActivation implements VendorActivationPort {
  constructor(private readonly rbac: RbacService) {}
  async onVendorApproved(userId: string): Promise<void> {
    const view = await this.rbac.getUserView(userId);
    if (view.user.status === 'pending_kyc') await this.rbac.setUserStatus(userId, 'ACTIVATE');
    await this.rbac.grantRole(userId, 'vendor.owner', 'vendor-approval');
  }
}

/** IAM → vendor-approval: create the linked approval record at signup (shared id). */
export function makeApprovalProvisioner(service: VendorApprovalService): VendorApprovalProvisioner {
  return {
    async createApprovalRecord(input) {
      await service.register(
        { name: input.name, contactEmail: input.contactEmail, vendorId: input.vendorId, userId: input.userId },
        { actor: 'SYSTEM_SIGNUP' },
      );
    },
  };
}

/** Build the production (Mongo-backed) vendor-approval service. */
export function createVendorApprovalService(activation: VendorActivationPort | null = null): VendorApprovalService {
  return new VendorApprovalService(
    new MongoVendorRepository(),
    new MongoAuditRepository(),
    activation,
    logger,
  );
}

/** Build the production vendor router, mounted at /lahtha. */
export function createLahthaVendorRouter(service: VendorApprovalService, authz: Authz): Router {
  return createVendorRouter(service, authz);
}
