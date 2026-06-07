import { describe, it, expect, beforeEach } from 'vitest';
import express, { Router, type Express } from 'express';
import request from 'supertest';
import { correlationId } from '../src/middleware/correlation-id.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { createIamRouter } from '../src/domains/iam/iam.routes.js';
import { createAuthz } from '../src/domains/iam/authz.js';
import type { IamDeps } from '../src/domains/iam/use-cases.js';
import {
  CapturingOtpSender,
  FakeMfaVerifier,
  SystemClock,
  InMemoryOtpChallengeRepository,
  InMemorySessionRepository,
  InMemoryVendorIdentityRepository,
  InMemoryVendorStatus,
} from '../src/domains/iam/in-memory-adapters.js';
import { RbacService } from '../src/domains/iam/rbac/rbac.service.js';
import { RbacVendorAccountProvisioner } from '../src/domains/iam/account-provisioner.js';
import { createRbacRouter } from '../src/domains/iam/rbac/rbac.routes.js';
import {
  InMemoryAccessAuditRepository,
  InMemoryPersonRepository,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from '../src/domains/iam/rbac/rbac.in-memory.js';

const silentLogger = { info: () => {}, warn: () => {} };

// Mirrors module.ts but with in-memory adapters + allowHeaderActor=false (prod-like).
function makeModule() {
  const clock = new SystemClock();
  const rbac = new RbacService({
    persons: new InMemoryPersonRepository(),
    users: new InMemoryUserRepository(),
    grants: new InMemoryRoleGrantRepository(),
    audit: new InMemoryAccessAuditRepository(),
    clock,
    logger: silentLogger,
    piiPepper: 'test-pii-pepper',
  });
  const iam: IamDeps = {
    identities: new InMemoryVendorIdentityRepository(),
    otps: new InMemoryOtpChallengeRepository(),
    sessions: new InMemorySessionRepository(),
    vendorStatus: new InMemoryVendorStatus(),
    provisioner: new RbacVendorAccountProvisioner(rbac),
    otpSender: new CapturingOtpSender(),
    mfa: new FakeMfaVerifier(),
    clock,
    logger: silentLogger,
    otpPepper: 'test-pepper',
  };
  const authz = createAuthz(iam, rbac);

  const iamRouter = Router();
  iamRouter.use(createIamRouter(iam, { exposeDevCode: true, secureCookies: false }));
  iamRouter.get('/me', authz.me);
  iamRouter.get(
    '/secure/vendor-profile',
    authz.requirePermission('lahtha.vendor.manage_profile'),
    (req, res) => res.json({ ok: true, userId: req.principalUserId }),
  );
  iamRouter.use(authz.attachPrincipal, createRbacRouter(rbac, { allowHeaderActor: false }));

  const app = express();
  app.use(correlationId);
  app.use(express.json());
  app.use('/iam', iamRouter);
  app.use(errorHandler);
  return { app, rbac };
}

async function registerAndLogin(app: Express) {
  const reg = await request(app)
    .post('/iam/vendors')
    .send({ businessName: 'Acme Devices', ownerFullName: 'Sara Owner', email: 'ops@acme.test', phone: '+966500000000' });
  expect(reg.status).toBe(201);
  const { vendorId, userId, personId } = reg.body as { vendorId: string; userId: string; personId: string };

  const otp = await request(app).post('/iam/auth/otp/request').send({ vendorId });
  const verify = await request(app).post('/iam/auth/otp/verify').send({ vendorId, code: otp.body.devCode });
  return { vendorId, userId, personId, token: verify.body.token as string };
}

describe('IAM bridge — session principal + RBAC', () => {
  let app: Express;
  let rbac: RbacService;
  beforeEach(() => {
    const m = makeModule();
    app = m.app;
    rbac = m.rbac;
  });

  it('registration provisions a linked person + vendor principal', async () => {
    const reg = await request(app)
      .post('/iam/vendors')
      .send({ businessName: 'Acme', ownerFullName: 'Sara', email: 'a@acme.test', phone: '+966500000001' });
    expect(reg.body.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(reg.body.personId).toMatch(/^[0-9a-f-]{36}$/);
    const view = await rbac.getUserView(reg.body.userId);
    expect(view.user.principalType).toBe('vendor');
  });

  it('GET /me returns the session-bound principal, roles and permissions', async () => {
    const { token, userId, personId } = await registerAndLogin(app);
    const res = await request(app).get('/iam/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.principal).toMatchObject({
      userId,
      personId,
      principalType: 'vendor',
      status: 'pending_kyc',
      roles: [],
      permissions: [],
    });
    expect(res.body.session.userId).toBe(userId);
  });

  it('/me requires a session', async () => {
    const res = await request(app).get('/iam/me');
    expect(res.status).toBe(401);
  });

  it('denies a permission-gated route until the principal is active AND granted', async () => {
    const { token, userId } = await registerAndLogin(app);

    // pending_kyc, no roles -> denied
    let res = await request(app).get('/iam/secure/vendor-profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.requiredPermission).toBe('lahtha.vendor.manage_profile');

    // Admin activates + grants the role (out of band).
    await rbac.setUserStatus(userId, 'ACTIVATE');
    await rbac.grantRole(userId, 'vendor.owner', 'admin');

    // Same token now passes — the check reads live RBAC state, not cached scopes.
    res = await request(app).get('/iam/secure/vendor-profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, userId });
  });

  it('a granted-but-suspended principal is denied again', async () => {
    const { token, userId } = await registerAndLogin(app);
    await rbac.setUserStatus(userId, 'ACTIVATE');
    await rbac.grantRole(userId, 'vendor.owner', 'admin');
    await rbac.setUserStatus(userId, 'SUSPEND');
    const res = await request(app).get('/iam/secure/vendor-profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('SECURITY: a spoofed x-user-id header cannot authorize without a session', async () => {
    // Provision an admin principal and grant it broad permission out of band.
    const { personId } = await registerAndLogin(app); // reuse to get a person
    void personId;
    const person = await rbac.createPerson({ fullName: 'Admin', primaryPhone: '+966511111111' });
    const admin = await rbac.createUser(person.personId, 'admin');
    await rbac.setUserStatus(admin.userId, 'ACTIVATE');
    await rbac.grantRole(admin.userId, 'admin.support', 'root'); // has platform.read_all

    // Attempt to use the admin's id via header, with NO session token.
    const res = await request(app).get('/iam/rbac/ping').set('x-user-id', admin.userId);
    expect(res.status).toBe(401); // header is not trusted; session principal required
  });
});
