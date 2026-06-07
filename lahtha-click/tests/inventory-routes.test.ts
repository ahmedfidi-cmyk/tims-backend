import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { correlationId } from '../src/middleware/correlation-id.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { createInventoryRouter } from '../src/domains/lahtha/inventory/inventory.routes.js';
import { InventoryService } from '../src/domains/lahtha/inventory/inventory.service.js';
import {
  InMemoryDeviceDocumentRepository,
  InMemoryDeviceOwnershipRepository,
  InMemoryDeviceRepository,
  StubObjectStorage,
  SystemClock,
} from '../src/domains/lahtha/inventory/in-memory-adapters.js';
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
  SystemClock as IamSystemClock,
} from '../src/domains/iam/in-memory-adapters.js';
import { RbacService } from '../src/domains/iam/rbac/rbac.service.js';
import { RbacVendorAccountProvisioner } from '../src/domains/iam/account-provisioner.js';
import {
  InMemoryAccessAuditRepository,
  InMemoryPersonRepository,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from '../src/domains/iam/rbac/rbac.in-memory.js';
import { withLuhn } from './inventory-core.test.js';
import type { PrincipalType } from '../src/domains/iam/rbac/rbac-policy.js';

const silentLogger = { info: () => {}, warn: () => {} };
const SHA = 'a'.repeat(64);
let phoneSeq = 600000000;

function setup() {
  const clock = new IamSystemClock();
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

  const service = new InventoryService({
    devices: new InMemoryDeviceRepository(),
    ownership: new InMemoryDeviceOwnershipRepository(),
    documents: new InMemoryDeviceDocumentRepository(),
    storage: new StubObjectStorage('test-bucket', new SystemClock()),
    clock: new SystemClock(),
    logger: silentLogger,
  });

  const app = express();
  app.use(correlationId);
  app.use(express.json());
  app.use('/lahtha/inventory', createInventoryRouter(service, authz));
  app.use(errorHandler);

  // Mint an authenticated session for a fresh principal holding `role`.
  async function sessionFor(principalType: PrincipalType, role: string): Promise<string> {
    const person = await rbac.createPerson({ fullName: 'User', primaryPhone: `+966${phoneSeq++}` });
    const user = await rbac.createUser(person.personId, principalType);
    await rbac.setUserStatus(user.userId, 'ACTIVATE');
    await rbac.grantRole(user.userId, role, 'admin');
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

function registration(overrides: Record<string, unknown> = {}) {
  return {
    imei: withLuhn(String(490154203237510 + Math.floor(Math.random() * 9)).slice(0, 14)),
    serialNumber: 'SN-' + Math.random().toString(36).slice(2),
    modelCode: 'A3105',
    condition: 'new_sealed',
    invoice: {
      documentType: 'supplier_invoice',
      s3Bucket: 'b',
      s3Key: 'k-' + Math.random().toString(36).slice(2),
      sha256: SHA,
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    },
    ...overrides,
  };
}

describe('Inventory HTTP API', () => {
  let app: Express;
  let sessionFor: (p: PrincipalType, r: string) => Promise<string>;

  beforeEach(() => {
    const s = setup();
    app = s.app;
    sessionFor = s.sessionFor;
  });

  it('exposes the model catalog without auth', async () => {
    const res = await request(app).get('/lahtha/inventory/models');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('401s an unauthenticated registration', async () => {
    const res = await request(app).post('/lahtha/inventory/devices').send(registration());
    expect(res.status).toBe(401);
  });

  it('403s a principal lacking lahtha.device.register', async () => {
    const token = await sessionFor('vendor', 'vendor.owner'); // owner lacks device.register
    const res = await request(app)
      .post('/lahtha/inventory/devices')
      .set('Authorization', `Bearer ${token}`)
      .send(registration());
    expect(res.status).toBe(403);
    expect(res.body.requiredPermission).toBe('lahtha.device.register');
  });

  it('registers a device for a warehouse manager (201)', async () => {
    const token = await sessionFor('vendor', 'vendor.warehouse_manager');
    const res = await request(app)
      .post('/lahtha/inventory/devices')
      .set('Authorization', `Bearer ${token}`)
      .send(registration());
    expect(res.status).toBe(201);
    expect(res.body.state).toBe('with_vendor');
    expect(res.body.documents).toHaveLength(1);
  });

  it('rejects registration without the mandatory invoice (400)', async () => {
    const token = await sessionFor('vendor', 'vendor.warehouse_manager');
    const body = registration();
    delete (body as Record<string, unknown>).invoice;
    const res = await request(app)
      .post('/lahtha/inventory/devices')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('rejects a bad IMEI checksum (400)', async () => {
    const token = await sessionFor('vendor', 'vendor.warehouse_manager');
    const res = await request(app)
      .post('/lahtha/inventory/devices')
      .set('Authorization', `Bearer ${token}`)
      .send(registration({ imei: '490154203237519' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_imei');
  });

  it('rejects an unknown model (422)', async () => {
    const token = await sessionFor('vendor', 'vendor.warehouse_manager');
    const res = await request(app)
      .post('/lahtha/inventory/devices')
      .set('Authorization', `Bearer ${token}`)
      .send(registration({ modelCode: 'Z9999' }));
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('unknown_model');
  });

  it('lists and reads devices with device.list, and presigns an upload', async () => {
    const wh = await sessionFor('vendor', 'vendor.warehouse_manager');
    const created = await request(app)
      .post('/lahtha/inventory/devices')
      .set('Authorization', `Bearer ${wh}`)
      .send(registration());
    const deviceId = created.body.device.deviceId as string;
    const ownerId = created.body.currentOwner.ownerId as string;

    const get = await request(app)
      .get(`/lahtha/inventory/devices/${deviceId}`)
      .set('Authorization', `Bearer ${wh}`);
    expect(get.status).toBe(200);

    const list = await request(app)
      .get(`/lahtha/inventory/devices?ownerId=${ownerId}`)
      .set('Authorization', `Bearer ${wh}`);
    expect(list.body.items.map((d: { deviceId: string }) => d.deviceId)).toContain(deviceId);

    const presign = await request(app)
      .post(`/lahtha/inventory/devices/${deviceId}/documents/upload-url`)
      .set('Authorization', `Bearer ${wh}`)
      .send({ documentType: 'box_photo', contentType: 'image/jpeg' });
    expect(presign.status).toBe(200);
    expect(presign.body.url).toContain(deviceId);
  });

  it('transfers ownership only with lahtha.state.override', async () => {
    const wh = await sessionFor('vendor', 'vendor.warehouse_manager');
    const created = await request(app)
      .post('/lahtha/inventory/devices')
      .set('Authorization', `Bearer ${wh}`)
      .send(registration());
    const deviceId = created.body.device.deviceId as string;

    // Warehouse manager cannot transfer.
    const denied = await request(app)
      .post(`/lahtha/inventory/devices/${deviceId}/transfer`)
      .set('Authorization', `Bearer ${wh}`)
      .send({ newOwnerId: 'lahtha', newOwnerType: 'lahtha_custody', acquisitionType: 'transfer_in' });
    expect(denied.status).toBe(403);

    // Ops can.
    const ops = await sessionFor('admin', 'admin.ops');
    const ok = await request(app)
      .post(`/lahtha/inventory/devices/${deviceId}/transfer`)
      .set('Authorization', `Bearer ${ops}`)
      .send({ newOwnerId: 'lahtha', newOwnerType: 'lahtha_custody', acquisitionType: 'transfer_in' });
    expect(ok.status).toBe(201);
    expect(ok.body.ownerId).toBe('lahtha');
  });
});
