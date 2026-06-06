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
    nationalId?: string;
  }): Promise<{ personId: string; userId: string }> {
    return this.rbac.provisionPrincipal({
      fullName: input.ownerFullName,
      primaryPhone: input.phone,
      principalType: 'vendor',
      ...(input.nationalId ? { nationalId: input.nationalId } : {}),
    });
  }
}
