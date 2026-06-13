import { describe, it, expect, beforeEach } from 'vitest';
import { VendorApprovalService } from '../src/domains/lahtha/vendor/vendor.service.js';
import {
  InMemoryAuditRepository,
  InMemoryVendorRepository,
} from '../src/domains/lahtha/vendor/in-memory-repositories.js';
import { RbacVendorActivation, makeApprovalProvisioner } from '../src/domains/lahtha/vendor/index.js';
import { VENDOR_STATES } from '../src/domains/lahtha/vendor/vendor-approval.js';
import type { VendorActivationPort } from '../src/domains/lahtha/vendor/types.js';
import { RbacService } from '../src/domains/iam/rbac/rbac.service.js';
import {
  InMemoryAccessAuditRepository,
  InMemoryPersonRepository,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from '../src/domains/iam/rbac/rbac.in-memory.js';
import { registerVendorIdentity, type IamDeps } from '../src/domains/iam/use-cases.js';
import { RbacVendorAccountProvisioner } from '../src/domains/iam/account-provisioner.js';
import {
  CapturingOtpSender,
  FakeMfaVerifier,
  InMemoryOtpChallengeRepository,
  InMemorySessionRepository,
  InMemoryVendorIdentityRepository,
  InMemoryVendorStatus,
  SystemClock,
} from '../src/domains/iam/in-memory-adapters.js';

const silentLogger = { info: () => {}, warn: () => {} };
const ctx = { actor: 'admin', correlationId: 'c' };

describe('VendorApprovalService — activation port on approve', () => {
  class CapturingActivation implements VendorActivationPort {
    calls: string[] = [];
    async onVendorApproved(userId: string) {
      this.calls.push(userId);
    }
  }

  function build(activation: VendorActivationPort | null) {
    return new VendorApprovalService(
      new InMemoryVendorRepository(),
      new InMemoryAuditRepository(),
      activation,
      silentLogger,
    );
  }

  async function toApproved(svc: VendorApprovalService, vendorId: string, userId: string | null) {
    await svc.register({ name: 'Acme', contactEmail: 'a@a.test', vendorId, ...(userId ? { userId } : {}) }, ctx);
    await svc.submitOwnershipProof(vendorId, 's3://cr.pdf', ctx);
    return svc.approve(vendorId, ctx);
  }

  it('calls the activation port with the linked userId', async () => {
    const activation = new CapturingActivation();
    const svc = build(activation);
    const v = await toApproved(svc, 'v1', 'u1');
    expect(v.status).toBe(VENDOR_STATES.LAHTHA_APPROVED);
    expect(activation.calls).toEqual(['u1']);
  });

  it('does not activate an unlinked (userId=null) record', async () => {
    const activation = new CapturingActivation();
    const svc = build(activation);
    const v = await toApproved(svc, 'v2', null);
    expect(v.status).toBe(VENDOR_STATES.LAHTHA_APPROVED);
    expect(activation.calls).toEqual([]);
  });

  it('approval succeeds even when activation throws (best-effort)', async () => {
    const throwing: VendorActivationPort = {
      async onVendorApproved() {
        throw new Error('rbac down');
      },
    };
    const svc = build(throwing);
    const v = await toApproved(svc, 'v3', 'u3');
    expect(v.status).toBe(VENDOR_STATES.LAHTHA_APPROVED);
  });
});

describe('signup → approval linking (end-to-end, in-memory)', () => {
  let rbac: RbacService;
  let vendorService: VendorApprovalService;
  let iam: IamDeps;

  beforeEach(() => {
    const clock = new SystemClock();
    rbac = new RbacService({
      persons: new InMemoryPersonRepository(),
      users: new InMemoryUserRepository(),
      grants: new InMemoryRoleGrantRepository(),
      audit: new InMemoryAccessAuditRepository(),
      clock,
      logger: silentLogger,
      piiPepper: 'pii',
    });
    vendorService = new VendorApprovalService(
      new InMemoryVendorRepository(),
      new InMemoryAuditRepository(),
      new RbacVendorActivation(rbac),
      silentLogger,
    );
    iam = {
      identities: new InMemoryVendorIdentityRepository(),
      otps: new InMemoryOtpChallengeRepository(),
      sessions: new InMemorySessionRepository(),
      vendorStatus: new InMemoryVendorStatus(),
      provisioner: new RbacVendorAccountProvisioner(rbac),
      approvalProvisioner: makeApprovalProvisioner(vendorService),
      otpSender: new CapturingOtpSender(),
      mfa: new FakeMfaVerifier(),
      clock,
      logger: silentLogger,
      otpPepper: 'otp',
    };
  });

  it('vendor signup creates a linked approval record (shared id + userId)', async () => {
    const identity = await registerVendorIdentity(iam, {
      businessName: 'Acme Devices',
      email: 'ops@acme.test',
      phone: '+966500000000',
      principalType: 'vendor',
    });
    const vendor = await vendorService.getById(identity.vendorId);
    expect(vendor.vendorId).toBe(identity.vendorId);
    expect(vendor.userId).toBe(identity.userId);
    expect(vendor.status).toBe(VENDOR_STATES.PENDING_OWNERSHIP_PROOF);
  });

  it('a customer signup does NOT create an approval record', async () => {
    const identity = await registerVendorIdentity(iam, {
      businessName: 'Sara',
      email: 'cust@acme.test',
      phone: '+966500000111',
      principalType: 'customer',
    });
    await expect(vendorService.getById(identity.vendorId)).rejects.toThrow();
  });

  it('approving the vendor activates the account + grants vendor.owner', async () => {
    const identity = await registerVendorIdentity(iam, {
      businessName: 'Acme Devices',
      email: 'ops2@acme.test',
      phone: '+966500000222',
      principalType: 'vendor',
    });
    // Before approval: pending_kyc, no roles.
    let view = await rbac.getUserView(identity.userId);
    expect(view.user.status).toBe('pending_kyc');
    expect(view.roles).toEqual([]);

    await vendorService.submitOwnershipProof(identity.vendorId, 's3://cr.pdf', ctx);
    await vendorService.approve(identity.vendorId, ctx);

    view = await rbac.getUserView(identity.userId);
    expect(view.user.status).toBe('active');
    expect(view.roles).toContain('vendor.owner');
    expect(view.permissions).toContain('lahtha.vendor.manage_profile');
  });
});
