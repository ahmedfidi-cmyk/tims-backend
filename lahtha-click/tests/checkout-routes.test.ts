import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { correlationId } from '../src/middleware/correlation-id.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { createCheckoutRouter } from '../src/domains/lahtha/checkout/checkout.routes.js';
import { CheckoutService } from '../src/domains/lahtha/checkout/checkout.service.js';
import {
  FakeInventoryPort,
  InMemoryOrderRepository,
  SystemClock,
} from '../src/domains/lahtha/checkout/in-memory-adapters.js';
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
import type { PrincipalType } from '../src/domains/iam/rbac/rbac-policy.js';

const silentLogger = { info: () => {}, warn: () => {} };
let phoneSeq = 700000000;

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

  const inventory = new FakeInventoryPort();
  const service = new CheckoutService({
    orders: new InMemoryOrderRepository(),
    inventory,
    clock: new SystemClock(),
    logger: silentLogger,
  });

  const app = express();
  app.use(correlationId);
  app.use(express.json());
  app.use('/lahtha', createCheckoutRouter(service, authz));
  app.use(errorHandler);

  async function sessionFor(principalType: PrincipalType, role: string): Promise<{ token: string; userId: string }> {
    const person = await rbac.createPerson({ fullName: 'U', primaryPhone: `+966${phoneSeq++}` });
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
    return { token, userId: user.userId };
  }

  return { app, sessionFor, inventory };
}

const PLACE = { deviceId: 'dev-1', fulfillmentType: 'physical_fulfillment', subtotalHalalat: 100_000 };

describe('Checkout HTTP API', () => {
  let app: Express;
  let sessionFor: (p: PrincipalType, r: string) => Promise<{ token: string; userId: string }>;
  let inventory: FakeInventoryPort;

  beforeEach(() => {
    const s = setup();
    app = s.app;
    sessionFor = s.sessionFor;
    inventory = s.inventory;
    inventory.setOwner('dev-1', { ownerId: 'vendor-1', ownerType: 'vendor' });
  });

  it('401s unauthenticated order placement', async () => {
    const res = await request(app).post('/lahtha/orders').send(PLACE);
    expect(res.status).toBe(401);
  });

  it('403s a principal lacking lahtha.order.place', async () => {
    const { token } = await sessionFor('vendor', 'vendor.owner');
    const res = await request(app).post('/lahtha/orders').set('Authorization', `Bearer ${token}`).send(PLACE);
    expect(res.status).toBe(403);
    expect(res.body.requiredPermission).toBe('lahtha.order.place');
  });

  it('a customer places an order (201)', async () => {
    const { token } = await sessionFor('customer', 'customer.standard');
    const res = await request(app).post('/lahtha/orders').set('Authorization', `Bearer ${token}`).send(PLACE);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING_PAYMENT');
    expect(res.body.vendorUserId).toBe('vendor-1');
  });

  it('enforces order visibility (buyer/vendor only)', async () => {
    const buyer = await sessionFor('customer', 'customer.standard');
    const created = await request(app).post('/lahtha/orders').set('Authorization', `Bearer ${buyer.token}`).send(PLACE);
    const orderId = created.body.orderId as string;

    const asBuyer = await request(app).get(`/lahtha/orders/${orderId}`).set('Authorization', `Bearer ${buyer.token}`);
    expect(asBuyer.status).toBe(200);

    const stranger = await sessionFor('customer', 'customer.standard');
    const asStranger = await request(app).get(`/lahtha/orders/${orderId}`).set('Authorization', `Bearer ${stranger.token}`);
    expect(asStranger.status).toBe(403);
  });

  it('drives the full physical flow through ops (payment → ship → deliver)', async () => {
    const buyer = await sessionFor('customer', 'customer.standard');
    const ops = await sessionFor('admin', 'admin.ops');
    const created = await request(app).post('/lahtha/orders').set('Authorization', `Bearer ${buyer.token}`).send(PLACE);
    const orderId = created.body.orderId as string;

    const pay = await request(app)
      .post(`/lahtha/orders/${orderId}/payment-event`)
      .set('Authorization', `Bearer ${ops.token}`)
      .send({ outcome: 'captured', paymentRef: 'pay-1' });
    expect(pay.body.status).toBe('AWAITING_FULFILLMENT');

    await request(app)
      .post(`/lahtha/orders/${orderId}/ship`)
      .set('Authorization', `Bearer ${ops.token}`)
      .send({ shippingRef: 'TRK-1' })
      .expect(200);

    const delivered = await request(app)
      .post(`/lahtha/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${ops.token}`);
    expect(delivered.body.status).toBe('COMPLETED');
    expect(await inventory.getCurrentOwner('dev-1')).toMatchObject({ ownerType: 'customer' });
  });

  it('a buyer cannot drive ops-only transitions', async () => {
    const buyer = await sessionFor('customer', 'customer.standard');
    const created = await request(app).post('/lahtha/orders').set('Authorization', `Bearer ${buyer.token}`).send(PLACE);
    const orderId = created.body.orderId as string;
    const res = await request(app)
      .post(`/lahtha/orders/${orderId}/payment-event`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ outcome: 'captured', paymentRef: 'pay-1' });
    expect(res.status).toBe(403);
  });

  it('buyer cancels a pending order', async () => {
    const buyer = await sessionFor('customer', 'customer.standard');
    const created = await request(app).post('/lahtha/orders').set('Authorization', `Bearer ${buyer.token}`).send(PLACE);
    const orderId = created.body.orderId as string;
    const res = await request(app).post(`/lahtha/orders/${orderId}/cancel`).set('Authorization', `Bearer ${buyer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('admin refunds a paid digital order', async () => {
    inventory.setOwner('dev-2', { ownerId: 'vendor-1', ownerType: 'vendor' });
    const buyer = await sessionFor('customer', 'customer.standard');
    const ops = await sessionFor('admin', 'admin.ops');
    const created = await request(app)
      .post('/lahtha/orders')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ deviceId: 'dev-2', fulfillmentType: 'digital_custody', subtotalHalalat: 100_000 });
    const orderId = created.body.orderId as string;
    await request(app)
      .post(`/lahtha/orders/${orderId}/payment-event`)
      .set('Authorization', `Bearer ${ops.token}`)
      .send({ outcome: 'captured', paymentRef: 'pay-1' });
    const refund = await request(app).post(`/lahtha/orders/${orderId}/refund`).set('Authorization', `Bearer ${ops.token}`);
    expect(refund.status).toBe(200);
    expect(refund.body.status).toBe('REFUNDED');
  });
});
