import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { correlationId } from '../src/middleware/correlation-id.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { createIamRouter } from '../src/domains/iam/iam.routes.js';
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
import {
  InMemoryAccessAuditRepository,
  InMemoryPersonRepository,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from '../src/domains/iam/rbac/rbac.in-memory.js';

const silentLogger = { info: () => {}, warn: () => {} };

function makeApp() {
  const vendorStatus = new InMemoryVendorStatus();
  const rbac = new RbacService({
    persons: new InMemoryPersonRepository(),
    users: new InMemoryUserRepository(),
    grants: new InMemoryRoleGrantRepository(),
    audit: new InMemoryAccessAuditRepository(),
    clock: new SystemClock(),
    logger: silentLogger,
    piiPepper: 'test-pii-pepper',
  });
  const deps: IamDeps = {
    identities: new InMemoryVendorIdentityRepository(),
    otps: new InMemoryOtpChallengeRepository(),
    sessions: new InMemorySessionRepository(),
    vendorStatus,
    provisioner: new RbacVendorAccountProvisioner(rbac),
    otpSender: new CapturingOtpSender(),
    mfa: new FakeMfaVerifier({ 'entra-good': { subject: 'oid-1', issuer: 'entra' } }),
    clock: new SystemClock(),
    logger: silentLogger,
    otpPepper: 'test-pepper',
  };
  const app = express();
  app.use(correlationId);
  app.use(express.json());
  app.use('/iam', createIamRouter(deps, { exposeDevCode: true, secureCookies: false }));
  app.use(errorHandler);
  return { app, vendorStatus };
}

async function loginVendor(app: Express): Promise<{ vendorId: string; token: string }> {
  const reg = await request(app)
    .post('/iam/vendors')
    .send({ businessName: 'Acme Devices', email: `v${Math.random()}@acme.test`, phone: '+966500000000' });
  expect(reg.status).toBe(201);
  const vendorId = reg.body.vendorId as string;

  const otp = await request(app).post('/iam/auth/otp/request').send({ vendorId, channel: 'sms' });
  expect(otp.status).toBe(200);
  const code = otp.body.devCode as string;
  expect(code).toMatch(/^\d{6}$/);

  const verify = await request(app).post('/iam/auth/otp/verify').send({ vendorId, code });
  expect(verify.status).toBe(200);
  return { vendorId, token: verify.body.token as string };
}

describe('IAM HTTP API', () => {
  let app: Express;
  let vendorStatus: InMemoryVendorStatus;

  beforeEach(() => {
    const built = makeApp();
    app = built.app;
    vendorStatus = built.vendorStatus;
  });

  it('rejects invalid registration with 400', async () => {
    const res = await request(app)
      .post('/iam/vendors')
      .send({ businessName: 'x', email: 'bad', phone: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('runs register -> OTP -> login and sets an HttpOnly session cookie', async () => {
    const reg = await request(app)
      .post('/iam/vendors')
      .send({ businessName: 'Acme Devices', email: 'ops@acme.test', phone: '+966500000000' });
    const vendorId = reg.body.vendorId as string;

    const otp = await request(app).post('/iam/auth/otp/request').send({ vendorId });
    const verify = await request(app).post('/iam/auth/otp/verify').send({ vendorId, code: otp.body.devCode });
    expect(verify.status).toBe(200);
    expect(verify.body.session.scopes).toContain('lahtha:access');
    expect(verify.body.session.scopes).not.toContain('click:access');

    const setCookie = verify.headers['set-cookie'][0] as string;
    expect(setCookie).toContain('lc_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('a wrong OTP code is rejected with 401', async () => {
    const reg = await request(app)
      .post('/iam/vendors')
      .send({ businessName: 'Acme Devices', email: 'ops2@acme.test', phone: '+966500000000' });
    const vendorId = reg.body.vendorId as string;
    await request(app).post('/iam/auth/otp/request').send({ vendorId });
    const verify = await request(app).post('/iam/auth/otp/verify').send({ vendorId, code: '000000' });
    expect(verify.status).toBe(401);
    expect(verify.body.error).toBe('otp_rejected');
  });

  it('GET /auth/session returns the current session via Bearer token', async () => {
    const { token, vendorId } = await loginVendor(app);
    const res = await request(app).get('/iam/auth/session').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.session.vendorId).toBe(vendorId);
  });

  it('unauthenticated access to a protected route is 401', async () => {
    const res = await request(app).get('/iam/click/ping');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthenticated');
  });

  it('CLICK is forbidden for a base session (LAHTHA login != click access)', async () => {
    const { token } = await loginVendor(app);
    const res = await request(app).get('/iam/click/ping').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.requiredScope).toBe('click:access');
  });

  it('MFA step-up on an unapproved vendor still cannot reach CLICK', async () => {
    const { token } = await loginVendor(app);
    const stepUp = await request(app)
      .post('/iam/auth/mfa/step-up')
      .set('Authorization', `Bearer ${token}`)
      .send({ idToken: 'entra-good' });
    expect(stepUp.status).toBe(200);
    expect(stepUp.body.session.mfaVerified).toBe(true);
    const res = await request(app).get('/iam/click/ping').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('approved vendor + MFA step-up unlocks CLICK', async () => {
    const { token, vendorId } = await loginVendor(app);
    vendorStatus.approve(vendorId);
    await request(app)
      .post('/iam/auth/mfa/step-up')
      .set('Authorization', `Bearer ${token}`)
      .send({ idToken: 'entra-good' });
    const res = await request(app).get('/iam/click/ping').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, vendorId });
  });

  it('a bad MFA token is rejected with 401', async () => {
    const { token } = await loginVendor(app);
    const res = await request(app)
      .post('/iam/auth/mfa/step-up')
      .set('Authorization', `Bearer ${token}`)
      .send({ idToken: 'forged' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('mfa_failed');
  });

  it('logout revokes the session (subsequent use is 401)', async () => {
    const { token } = await loginVendor(app);
    const out = await request(app).post('/iam/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(204);
    const after = await request(app).get('/iam/auth/session').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
    expect(after.body.reason).toBe('revoked');
  });

  it('accepts the session via cookie as well as Bearer', async () => {
    const { token, vendorId } = await loginVendor(app);
    const res = await request(app).get('/iam/auth/session').set('Cookie', `lc_session=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.session.vendorId).toBe(vendorId);
  });
});
