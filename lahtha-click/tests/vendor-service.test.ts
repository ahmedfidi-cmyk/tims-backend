import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConcurrencyError,
  VendorApprovalService,
  VendorNotFoundError,
} from '../src/domains/lahtha/vendor/vendor.service.js';
import { InvalidTransitionError, VENDOR_STATES } from '../src/domains/lahtha/vendor/vendor-approval.js';
import {
  InMemoryAuditRepository,
  InMemoryVendorRepository,
} from '../src/domains/lahtha/vendor/in-memory-repositories.js';

function build() {
  const vendors = new InMemoryVendorRepository();
  const audit = new InMemoryAuditRepository();
  const service = new VendorApprovalService(vendors, audit);
  return { vendors, audit, service };
}

const ctx = { actor: 'admin', correlationId: 'corr-test' };

describe('VendorApprovalService', () => {
  let service: VendorApprovalService;
  let vendors: InMemoryVendorRepository;

  beforeEach(() => {
    const built = build();
    service = built.service;
    vendors = built.vendors;
  });

  it('registers a vendor in PENDING_OWNERSHIP_PROOF with audit', async () => {
    const v = await service.register(
      { name: 'Acme', contactEmail: 'ops@acme.test' },
      { actor: 'SYSTEM_REGISTRATION' },
    );
    expect(v.status).toBe(VENDOR_STATES.PENDING_OWNERSHIP_PROOF);
    expect(v.vendorId).toMatch(/^[0-9a-f-]{36}$/);

    const trail = await service.getAuditTrail(v.vendorId);
    expect(trail).toHaveLength(1);
    expect(trail[0]?.action).toBe('VENDOR_REGISTERED');
    expect(trail[0]?.previousState).toBe('NONE');
    expect(trail[0]?.newState).toBe(VENDOR_STATES.PENDING_OWNERSHIP_PROOF);
  });

  it('drives the full happy path to approval and unlocks CLICK', async () => {
    const v = await service.register({ name: 'Acme', contactEmail: 'a@a.test' }, ctx);

    let denied = await service.getClickAccess(v.vendorId);
    expect(denied.clickAccess).toBe(false);

    await service.submitOwnershipProof(v.vendorId, 's3://docs/cr.pdf', ctx);
    const approved = await service.approve(v.vendorId, ctx);
    expect(approved.status).toBe(VENDOR_STATES.LAHTHA_APPROVED);

    const granted = await service.getClickAccess(v.vendorId);
    expect(granted.clickAccess).toBe(true);

    // Rule 20: one audit entry per transition (register, submit, approve).
    const trail = await service.getAuditTrail(v.vendorId);
    expect(trail.map((e) => e.action)).toEqual([
      'VENDOR_REGISTERED',
      'OWNERSHIP_PROOF_SUBMITTED',
      'VENDOR_APPROVED',
    ]);
  });

  it('rejection captures a reason and allows resubmission', async () => {
    const v = await service.register({ name: 'Acme', contactEmail: 'a@a.test' }, ctx);
    await service.submitOwnershipProof(v.vendorId, 's3://docs/cr.pdf', ctx);

    const rejected = await service.reject(v.vendorId, 'CR document expired', ctx);
    expect(rejected.status).toBe(VENDOR_STATES.REJECTED);
    expect(rejected.rejectionReason).toBe('CR document expired');

    const resubmitted = await service.submitOwnershipProof(v.vendorId, 's3://docs/cr-v2.pdf', ctx);
    expect(resubmitted.status).toBe(VENDOR_STATES.PENDING_REVIEW);
  });

  it('refuses to approve before review (no shortcut)', async () => {
    const v = await service.register({ name: 'Acme', contactEmail: 'a@a.test' }, ctx);
    await expect(service.approve(v.vendorId, ctx)).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('refuses to approve twice', async () => {
    const v = await service.register({ name: 'Acme', contactEmail: 'a@a.test' }, ctx);
    await service.submitOwnershipProof(v.vendorId, 's3://docs/cr.pdf', ctx);
    await service.approve(v.vendorId, ctx);
    await expect(service.approve(v.vendorId, ctx)).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('throws VendorNotFoundError for unknown ids', async () => {
    await expect(service.getById('nope')).rejects.toBeInstanceOf(VendorNotFoundError);
    await expect(service.approve('nope', ctx)).rejects.toBeInstanceOf(VendorNotFoundError);
  });

  it('surfaces a concurrency conflict when the guarded write loses the race', async () => {
    const v = await service.register({ name: 'Acme', contactEmail: 'a@a.test' }, ctx);
    await service.submitOwnershipProof(v.vendorId, 's3://docs/cr.pdf', ctx);
    // Simulate another writer moving the state out from under the approve call.
    await vendors.updateState(v.vendorId, VENDOR_STATES.PENDING_REVIEW, {
      status: VENDOR_STATES.LAHTHA_APPROVED,
    });
    // The service read PENDING_REVIEW earlier in a real race; here we force the
    // mismatch by pointing the guarded update at a now-stale expected state.
    const stale = await vendors.updateState(v.vendorId, VENDOR_STATES.PENDING_REVIEW, {
      status: VENDOR_STATES.REJECTED,
    });
    expect(stale).toBeNull();
  });

  it('audit entries are append-only and chronological', async () => {
    const v = await service.register({ name: 'Acme', contactEmail: 'a@a.test' }, ctx);
    await service.submitOwnershipProof(v.vendorId, 's3://docs/cr.pdf', ctx);
    await service.reject(v.vendorId, 'bad docs', ctx);
    const trail = await service.getAuditTrail(v.vendorId);
    const times = trail.map((e) => e.timestamp.getTime());
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
    expect(trail.at(-1)?.metadata).toMatchObject({ reason: 'bad docs' });
  });
});

describe('ConcurrencyError shape', () => {
  it('is thrown by the service when updateState returns null', async () => {
    // A vendor repo whose updateState always reports a lost race.
    const losingVendors = new InMemoryVendorRepository();
    const audit = new InMemoryAuditRepository();
    const svc = new VendorApprovalService(
      {
        create: losingVendors.create.bind(losingVendors),
        findById: losingVendors.findById.bind(losingVendors),
        updateState: async () => null,
      },
      audit,
    );
    const v = await svc.register({ name: 'Acme', contactEmail: 'a@a.test' }, ctx);
    await expect(svc.submitOwnershipProof(v.vendorId, 'ref', ctx)).rejects.toBeInstanceOf(
      ConcurrencyError,
    );
  });
});
