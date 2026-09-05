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
  // Header-actor mode (dev/bootstrap); production resolves the actor from the session.
  app.use('/iam', createRbacRouter(service, { allowHeaderActor: true }));
  app.use(errorHandler);
  return { app, service };
}

// Bootstrap an admin OUT OF BAND via the service (the gated HTTP routes can't
// create the first admin — same as scripts/seed-admin.ts).
async function bootstrapAdmin(service: RbacService, role = 'admin.ops'): Promise<string> {
  const person = await service.createPerson({
    fullName: 'Admin',
    primaryPhone: `+9665${Math.floor(Math.random() * 1e8)}`,
  });
  const user = await service.createUser(person.personId, 'admin');
  await service.setUserStatus(user.userId, 'ACTIVATE');
  await service.grantRole(user.userId, role, 'seed');
  return user.userId;
}

describe('RBAC HTTP API', () => {
  let app: Express;
  let service: RbacService;
  let adminId: string; // admin.ops — holds platform.iam.manage
  beforeEach(async () => {
    const built = makeApp();
    app = built.app;
    service = built.service;
    adminId = await bootstrapAdmin(service, 'admin.ops');
  });

  const asAdmin = (req: request.Test) => req.set('x-user-id', adminId);

  it('lists the seed role catalog', async () => {
    const res = await request(app).get('/iam/roles');
    expect(res.status).toBe(200);
    expect(res.body.items.some((r: { roleId: string }) => r.roleId === 'admin.compliance')).toBe(true);
  });

  it('validates person creation', async () => {
    const res = await request(app).post('/iam/persons').send({ fullName: 'x', primaryPhone: 'bad' });
    expect(res.status).toBe(400);
  });

  it('creates a person + principal and (admin) grants a coherent role', async () => {
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

    await asAdmin(request(app).post(`/iam/users/${userId}/status`)).send({ action: 'ACTIVATE' }).expect(200);
    await asAdmin(request(app).post(`/iam/users/${userId}/roles`)).send({ roleId: 'vendor.owner' }).expect(204);

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
    const res = await asAdmin(request(app).post(`/iam/users/${user.body.userId}/roles`)).send({ roleId: 'admin.ops' });
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
    const res = await asAdmin(request(app).post(`/iam/users/${user.body.userId}/status`)).send({ action: 'SUSPEND' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('invalid_status_transition');
  });

  describe('admin-gated management routes (platform.iam.manage)', () => {
    it('401 without an actor on role grant', async () => {
      const person = await request(app).post('/iam/persons').send({ fullName: 'Xavier', primaryPhone: '+966500000014' });
      const user = await request(app)
        .post(`/iam/persons/${person.body.personId}/users`)
        .send({ principalType: 'vendor' });
      const res = await request(app).post(`/iam/users/${user.body.userId}/roles`).send({ roleId: 'vendor.owner' });
      expect(res.status).toBe(401);
    });

    it('403 for a non-admin actor on role grant', async () => {
      const vp = await request(app).post('/iam/persons').send({ fullName: 'Vera', primaryPhone: '+966500000015' });
      const vu = await request(app).post(`/iam/persons/${vp.body.personId}/users`).send({ principalType: 'vendor' });
      await asAdmin(request(app).post(`/iam/users/${vu.body.userId}/status`)).send({ action: 'ACTIVATE' });
      await asAdmin(request(app).post(`/iam/users/${vu.body.userId}/roles`)).send({ roleId: 'vendor.owner' });
      // vendor.owner lacks platform.iam.manage
      const res = await request(app)
        .post(`/iam/users/${vu.body.userId}/roles`)
        .set('x-user-id', vu.body.userId)
        .send({ roleId: 'vendor.warehouse_manager' });
      expect(res.status).toBe(403);
      expect(res.body.requiredPermission).toBe('platform.iam.manage');
    });

    it('lists users (with roles) for an admin', async () => {
      const res = await asAdmin(request(app).get('/iam/admin/users?principalType=admin'));
      expect(res.status).toBe(200);
      expect(res.body.items.some((u: { user: { userId: string } }) => u.user.userId === adminId)).toBe(true);
      const me = res.body.items.find((u: { user: { userId: string } }) => u.user.userId === adminId);
      expect(me.roles).toContain('admin.ops');
    });

    it('401s an unauthenticated users list', async () => {
      const res = await request(app).get('/iam/admin/users');
      expect(res.status).toBe(401);
    });
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
      const res = await request(app).get('/iam/rbac/ping').set('x-user-id', vendorUser.body.userId);
      expect(res.status).toBe(403);
      expect(res.body.requiredPermission).toBe('platform.read_all');
    });

    it('200 for an actor holding the permission', async () => {
      const supportId = await bootstrapAdmin(service, 'admin.support');
      const res = await request(app).get('/iam/rbac/ping').set('x-user-id', supportId);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true, actorUserId: supportId });
    });

    it('gates the access-audit read behind platform.audit.read', async () => {
      const supportId = await bootstrapAdmin(service, 'admin.support'); // lacks audit.read
      const denied = await request(app).get('/iam/access-audit').set('x-user-id', supportId);
      expect(denied.status).toBe(403);

      const complianceId = await bootstrapAdmin(service, 'admin.compliance'); // has audit.read
      const ok = await request(app).get('/iam/access-audit').set('x-user-id', complianceId);
      expect(ok.status).toBe(200);
      expect(ok.body.items.some((e: { decision: string }) => e.decision === 'allow')).toBe(true);
    });
  });
});
