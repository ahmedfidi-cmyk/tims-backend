import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { correlationId } from '../src/middleware/correlation-id.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { createVendorRouter } from '../src/domains/lahtha/vendor/vendor.routes.js';
import { VendorApprovalService } from '../src/domains/lahtha/vendor/vendor.service.js';
import {
  InMemoryAuditRepository,
  InMemoryVendorRepository,
} from '../src/domains/lahtha/vendor/in-memory-repositories.js';

// Build an app that mirrors app.ts but uses in-memory repos (no MongoDB needed).
function makeApp(): Express {
  const service = new VendorApprovalService(
    new InMemoryVendorRepository(),
    new InMemoryAuditRepository(),
  );
  const app = express();
  app.use(correlationId);
  app.use(express.json());
  app.use('/lahtha', createVendorRouter(service));
  app.use(errorHandler);
  return app;
}

describe('vendor approval HTTP API', () => {
  let app: Express;

  beforeEach(() => {
    app = makeApp();
  });

  async function register(): Promise<string> {
    const res = await request(app)
      .post('/lahtha/vendors')
      .send({ name: 'Acme', contactEmail: 'ops@acme.test' });
    expect(res.status).toBe(201);
    return res.body.vendorId as string;
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

    await request(app)
      .post(`/lahtha/vendors/${id}/ownership-proof`)
      .send({ proofRef: 's3://docs/cr.pdf' })
      .expect(200);

    const approved = await request(app)
      .post(`/lahtha/admin/vendors/${id}/approve`)
      .set('x-actor-id', 'admin_001');
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('LAHTHA_APPROVED');

    const open = await request(app).get(`/lahtha/vendors/${id}/click-access`);
    expect(open.body.clickAccess).toBe(true);
  });

  it('blocks approval before review with 409', async () => {
    const id = await register();
    const res = await request(app).post(`/lahtha/admin/vendors/${id}/approve`);
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
    await request(app)
      .post(`/lahtha/vendors/${id}/ownership-proof`)
      .send({ proofRef: 's3://docs/cr.pdf' });
    const noReason = await request(app).post(`/lahtha/admin/vendors/${id}/reject`).send({});
    expect(noReason.status).toBe(400);

    const withReason = await request(app)
      .post(`/lahtha/admin/vendors/${id}/reject`)
      .send({ reason: 'CR expired' });
    expect(withReason.status).toBe(200);
    expect(withReason.body.status).toBe('REJECTED');
    expect(withReason.body.rejectionReason).toBe('CR expired');
  });

  it('exposes the audit trail (Rule 20) with one entry per transition', async () => {
    const id = await register();
    await request(app)
      .post(`/lahtha/vendors/${id}/ownership-proof`)
      .send({ proofRef: 's3://docs/cr.pdf' });
    await request(app).post(`/lahtha/admin/vendors/${id}/approve`);

    const res = await request(app).get(`/lahtha/vendors/${id}/audit`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((e: { action: string }) => e.action)).toEqual([
      'VENDOR_REGISTERED',
      'OWNERSHIP_PROOF_SUBMITTED',
      'VENDOR_APPROVED',
    ]);
  });

  it('propagates the correlation id into audit entries', async () => {
    const reg = await request(app)
      .post('/lahtha/vendors')
      .set('x-correlation-id', 'corr-abc')
      .send({ name: 'Acme', contactEmail: 'ops@acme.test' });
    const id = reg.body.vendorId as string;
    const res = await request(app).get(`/lahtha/vendors/${id}/audit`);
    expect(res.body.items[0].correlationId).toBe('corr-abc');
  });
});
