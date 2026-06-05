import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { correlationId } from '../src/middleware/correlation-id.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { createRbacRouter } from '../src/domains/iam/rbac/rbac.routes.js';
import { RbacService } from '../src/domains/iam/rbac/rbac.service.js';
import {
  InMemoryAccessAuditRepository,
  InMemoryPersonRepository,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from '../src/domains/iam/rbac/rbac.in-memory.js';
import { SystemClock } from '../src/domains/iam/in-memory-adapters.js';

const silentLogger = { info: () => {}, warn: () => {} };

function makeApp() {
  const service = new RbacService({
    persons: new InMemoryPersonRepository(),
    users: new InMemoryUserRepository(),
    grants: new InMemoryRoleGrantRepository(),
    audit: new InMemoryAccessAuditRepository(),
    clock: new SystemClock(),
    logger: silentLogger,
    piiPepper: 'test-pii-pepper',
  });
  const app = express();
  app.use(correlationId);
  app.use(express.json());
  app.use('/iam', createRbacRouter(service));
  app.use(errorHandler);
  return app;
}

async function makeActiveAdmin(app: Express, role: string): Promise<string> {
  const person = await request(app)
    .post('/iam/persons')
    .send({ fullName: 'Admin User', primaryPhone: `+9665${Math.floor(Math.random() * 1e8)}` });
  const userRes = await request(app)
    .post(`/iam/persons/${person.body.personId}/users`)
    .send({ principalType: 'admin' });
  const userId = userRes.body.userId as string;
  await request(app).post(`/iam/users/${userId}/status`).send({ action: 'ACTIVATE' });
  await request(app).post(`/iam/users/${userId}/roles`).send({ roleId: role });
  return userId;
}

describe('RBAC HTTP API', () => {
  let app: Express;
  beforeEach(() => {
    app = makeApp();
  });

  it('lists the seed role catalog', async () => {
    const res = await request(app).get('/iam/roles');
    expect(res.status).toBe(200);
    expect(res.body.items.some((r: { roleId: string }) => r.roleId === 'admin.compliance')).toBe(true);
  });

  it('validates person creation', async () => {
    const res = await request(app).post('/iam/persons').send({ fullName: 'x', primaryPhone: 'bad' });
    expect(res.status).toBe(400);
  });

  it('creates a person + principal and grants a coherent role', async () => {
    const person = await request(app)
      .post('/iam/persons')
      .send({ fullName: 'Sara A', primaryPhone: '+966500000010', nationalId: '1234567890' });
    expect(person.status).toBe(201);
    expect(person.body.hasNationalId).toBe(true);

    const user = await request(app)
      .post(`/iam/persons/${person.body.personId}/users`)
      .send({ principalType: 'vendor' });
    expect(user.status).toBe(201);
    const userId = user.body.userId as string;

    await request(app).post(`/iam/users/${userId}/status`).send({ action: 'ACTIVATE' }).expect(200);
    await request(app).post(`/iam/users/${userId}/roles`).send({ roleId: 'vendor.owner' }).expect(204);

    const view = await request(app).get(`/iam/users/${userId}`);
    expect(view.body.roles).toContain('vendor.owner');
    expect(view.body.permissions).toContain('lahtha.vendor.manage_profile');
  });

  it('rejects an incompatible role grant with 422', async () => {
    const person = await request(app)
      .post('/iam/persons')
      .send({ fullName: 'Sara', primaryPhone: '+966500000011' });
    const user = await request(app)
      .post(`/iam/persons/${person.body.personId}/users`)
      .send({ principalType: 'vendor' });
    const res = await request(app)
      .post(`/iam/users/${user.body.userId}/roles`)
      .send({ roleId: 'admin.ops' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('role_not_grantable');
  });

  it('rejects an illegal status transition with 409', async () => {
    const person = await request(app)
      .post('/iam/persons')
      .send({ fullName: 'Sara', primaryPhone: '+966500000012' });
    const user = await request(app)
      .post(`/iam/persons/${person.body.personId}/users`)
      .send({ principalType: 'vendor' });
    const res = await request(app)
      .post(`/iam/users/${user.body.userId}/status`)
      .send({ action: 'SUSPEND' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('invalid_status_transition');
  });

  describe('requirePermission middleware', () => {
    it('401 without an actor header', async () => {
      const res = await request(app).get('/iam/rbac/ping');
      expect(res.status).toBe(401);
    });

    it('403 for an actor lacking the permission', async () => {
      const vendorPerson = await request(app)
        .post('/iam/persons')
        .send({ fullName: 'Vendor V', primaryPhone: '+966500000013' });
      const vendorUser = await request(app)
        .post(`/iam/persons/${vendorPerson.body.personId}/users`)
        .send({ principalType: 'vendor' });
      const res = await request(app)
        .get('/iam/rbac/ping')
        .set('x-user-id', vendorUser.body.userId);
      expect(res.status).toBe(403);
      expect(res.body.requiredPermission).toBe('platform.read_all');
    });

    it('200 for an actor holding the permission', async () => {
      const adminId = await makeActiveAdmin(app, 'admin.support');
      const res = await request(app).get('/iam/rbac/ping').set('x-user-id', adminId);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true, actorUserId: adminId });
    });

    it('gates the access-audit read behind platform.audit.read', async () => {
      const supportId = await makeActiveAdmin(app, 'admin.support'); // lacks audit.read
      const denied = await request(app).get('/iam/access-audit').set('x-user-id', supportId);
      expect(denied.status).toBe(403);

      const complianceId = await makeActiveAdmin(app, 'admin.compliance'); // has audit.read
      const ok = await request(app).get('/iam/access-audit').set('x-user-id', complianceId);
      expect(ok.status).toBe(200);
      // The compliance read itself is audited (allow).
      expect(ok.body.items.some((e: { decision: string }) => e.decision === 'allow')).toBe(true);
    });
  });
});
