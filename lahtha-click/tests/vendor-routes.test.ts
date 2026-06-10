import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { correlationId } from '../src/middleware/correlation-id.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { createVendorRouter } from '../src/domains/lahtha/vendor/vendor.routes.js';
import { VendorApprovalService } from '../src/domains/lahtha/vendor/vendor.service.js';
import {
  InMemoryAuditRepository,
  InMemoryVendorRepository,
} from '../src/domains/lahtha/vendor/in-memory-repositories.js';
import { createAuthz } from '../src/domains/iam/authz.js';
import { issueSessionToken, sessionLifetimesFrom } from '../src/domains/iam/session.js';
import type { IamDeps } from '../src/domains/iam/use-cases.js';
import {
  CapturingOtpSender,
  FakeMfaVerifier,
  InMemoryOtpChallengeRepository,
  InMemorySessionRepository,
  InMemoryVendorIdentityRepository,
  InMemoryVendorStatus,
  SystemClock,
} from '../src/domains/iam/in-memory-adapters.js';
import { RbacService } from '../src/domains/iam/rbac/rbac.service.js';
import { RbacVendorAccountProvisioner } from '../src/domains/iam/account-provisioner.js';
import {
  InMemoryAccessAuditRepository,
  InMemoryPersonRepository,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from '../src/domains/iam/rbac/rbac.in-memory.js';
import type { PrincipalType } from '../src/domains/iam/rbac/rbac-policy.js';

const silentLogger = { info: () => {}, warn: () => {} };
let phoneSeq = 800000000;

function setup() {
  const clock = new SystemClock();
  const rbac = new RbacService({
    persons: new InMemoryPersonRepository(),
    users: new InMemoryUserRepository(),
    grants: new InMemoryRoleGrantRepository(),
    audit: new InMemoryAccessAuditRepository(),
    clock,
    logger: silentLogger,
    piiPepper: 'pii',
  });
  const sessions = new InMemorySessionRepository();
  const iam: IamDeps = {
    identities: new InMemoryVendorIdentityRepository(),
    otps: new InMemoryOtpChallengeRepository(),
    sessions,
    vendorStatus: new InMemoryVendorStatus(),
    provisioner: new RbacVendorAccountProvisioner(rbac),
    otpSender: new CapturingOtpSender(),
    mfa: new FakeMfaVerifier(),
    clock,
    logger: silentLogger,
    otpPepper: 'otp',
  };
  const authz = createAuthz(iam, rbac);

  const service = new VendorApprovalService(
    new InMemoryVendorRepository(),
    new InMemoryAuditRepository(),
  );
  const app = express();
  app.use(correlationId);
  app.use(express.json());
  app.use('/lahtha', createVendorRouter(service, authz));
  app.use(errorHandler);

  async function sessionFor(principalType: PrincipalType, role: string): Promise<string> {
    const person = await rbac.createPerson({ fullName: 'U', primaryPhone: `+966${phoneSeq++}` });
    const user = await rbac.createUser(person.personId, principalType);
    await rbac.setUserStatus(user.userId, 'ACTIVATE');
    await rbac.grantRole(user.userId, role, 'seed');
    const { token, tokenHash } = issueSessionToken();
    const now = clock.now();
    const lt = sessionLifetimesFrom(now);
    await sessions.create({
      sessionId: randomUUID(),
      tokenHash,
      vendorId: 'v',
      userId: user.userId,
      scopes: [],
      mfaVerified: false,
      device: null,
      createdAt: now,
      idleExpiresAt: lt.idleExpiresAt,
      absoluteExpiresAt: lt.absoluteExpiresAt,
      revokedAt: null,
    });
    return token;
  }

  return { app, sessionFor };
}

describe('vendor approval HTTP API', () => {
  let app: Express;
  let sessionFor: (p: PrincipalType, r: string) => Promise<string>;
  let adminToken: string;

  beforeEach(async () => {
    const s = setup();
    app = s.app;
    sessionFor = s.sessionFor;
    adminToken = await sessionFor('admin', 'admin.ops'); // has platform.vendor.review
  });

  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);

  async function register(): Promise<string> {
    const res = await request(app)
      .post('/lahtha/vendors')
      .send({ name: 'Acme', contactEmail: 'ops@acme.test' });
    expect(res.status).toBe(201);
    return res.body.vendorId as string;
  }

  async function toReview(id: string): Promise<void> {
    await request(app).post(`/lahtha/vendors/${id}/ownership-proof`).send({ proofRef: 's3://docs/cr.pdf' });
  }

  it('registers a vendor (201) in PENDING_OWNERSHIP_PROOF', async () => {
    const res = await request(app)
      .post('/lahtha/vendors')
      .send({ name: 'Acme', contactEmail: 'ops@acme.test' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING_OWNERSHIP_PROOF');
  });

  it('rejects invalid registration payloads with 400', async () => {
    const res = await request(app)
      .post('/lahtha/vendors')
      .send({ name: '', contactEmail: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('walks the full approval flow and opens CLICK access', async () => {
    const id = await register();
    const blocked = await request(app).get(`/lahtha/vendors/${id}/click-access`);
    expect(blocked.body.clickAccess).toBe(false);

    await toReview(id);
    const approved = await asAdmin(request(app).post(`/lahtha/admin/vendors/${id}/approve`));
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('LAHTHA_APPROVED');

    const open = await request(app).get(`/lahtha/vendors/${id}/click-access`);
    expect(open.body.clickAccess).toBe(true);
  });

  it('blocks approval before review with 409', async () => {
    const id = await register();
    const res = await asAdmin(request(app).post(`/lahtha/admin/vendors/${id}/approve`));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('invalid_state_transition');
    expect(res.body.from).toBe('PENDING_OWNERSHIP_PROOF');
  });

  it('returns 404 for an unknown vendor', async () => {
    const res = await request(app).get('/lahtha/vendors/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('vendor_not_found');
  });

  it('requires a reason to reject (400 otherwise)', async () => {
    const id = await register();
    await toReview(id);
    const noReason = await asAdmin(request(app).post(`/lahtha/admin/vendors/${id}/reject`)).send({});
    expect(noReason.status).toBe(400);

    const withReason = await asAdmin(request(app).post(`/lahtha/admin/vendors/${id}/reject`)).send({ reason: 'CR expired' });
    expect(withReason.status).toBe(200);
    expect(withReason.body.status).toBe('REJECTED');
    expect(withReason.body.rejectionReason).toBe('CR expired');
  });

  it('exposes the audit trail (Rule 20) with one entry per transition', async () => {
    const id = await register();
    await toReview(id);
    await asAdmin(request(app).post(`/lahtha/admin/vendors/${id}/approve`));

    const res = await request(app).get(`/lahtha/vendors/${id}/audit`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((e: { action: string }) => e.action)).toEqual([
      'VENDOR_REGISTERED',
      'OWNERSHIP_PROOF_SUBMITTED',
      'VENDOR_APPROVED',
    ]);
  });

  describe('admin authorization', () => {
    it('401s an unauthenticated approval', async () => {
      const id = await register();
      await toReview(id);
      const res = await request(app).post(`/lahtha/admin/vendors/${id}/approve`);
      expect(res.status).toBe(401);
    });

    it('403s a non-admin (vendor) principal', async () => {
      const vendorToken = await sessionFor('vendor', 'vendor.owner');
      const id = await register();
      await toReview(id);
      const res = await request(app)
        .post(`/lahtha/admin/vendors/${id}/approve`)
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.requiredPermission).toBe('platform.vendor.review');
    });

    it('lists the review queue for an admin', async () => {
      const id = await register();
      await toReview(id); // now PENDING_REVIEW
      const res = await asAdmin(request(app).get('/lahtha/admin/vendors?status=PENDING_REVIEW'));
      expect(res.status).toBe(200);
      expect(res.body.items.map((v: { vendorId: string }) => v.vendorId)).toContain(id);
    });

    it('401s an unauthenticated queue read', async () => {
      const res = await request(app).get('/lahtha/admin/vendors');
      expect(res.status).toBe(401);
    });
  });
});
