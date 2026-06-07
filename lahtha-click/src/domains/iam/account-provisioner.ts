// Bridge adapter: provisions/links the RBAC person + vendor principal for a
// registering vendor identity, using the RBAC service as the source of truth.

import type { VendorAccountProvisioner } from './types.js';
import type { RbacService } from './rbac/rbac.service.js';

export class RbacVendorAccountProvisioner implements VendorAccountProvisioner {
  constructor(private readonly rbac: RbacService) {}

  async provision(input: {
    businessName: string;
    ownerFullName: string;
    phone: string;
    principalType: 'vendor' | 'customer';
    nationalId?: string;
  }): Promise<{ personId: string; userId: string }> {
    const link = await this.rbac.provisionPrincipal({
      fullName: input.ownerFullName,
      primaryPhone: input.phone,
      principalType: input.principalType,
      ...(input.nationalId ? { nationalId: input.nationalId } : {}),
    });

    // Onboarding policy: customers are self-service (active immediately with the
    // standard role); vendors stay pending_kyc until admin approval.
    if (input.principalType === 'customer') {
      const view = await this.rbac.getUserView(link.userId);
      if (view.user.status === 'pending_kyc') {
        await this.rbac.setUserStatus(link.userId, 'ACTIVATE');
      }
      await this.rbac.grantRole(link.userId, 'customer.standard', 'self-service');
    }
    return link;
  }
}
