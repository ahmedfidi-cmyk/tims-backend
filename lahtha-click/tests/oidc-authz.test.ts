import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { attachOidcPrincipal } from '../src/domains/iam/oidc-authz.js';
import { FakeOidcVerifier, SystemClock } from '../src/domains/iam/in-memory-adapters.js';
import { RbacService } from '../src/domains/iam/rbac/rbac.service.js';
import {
  InMemoryAccessAuditRepository,
  InMemoryOidcIdentityLinkRepository,
  InMemoryPersonRepository,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from '../src/domains/iam/rbac/rbac.in-memory.js';

const silentLogger = { info: () => {}, warn: () => {} };
const ISSUER = 'https://idp.example.test';

function build() {
  const rbac = new RbacService({
    persons: new InMemoryPersonRepository(),
    users: new InMemoryUserRepository(),
    grants: new InMemoryRoleGrantRepository(),
    audit: new InMemoryAccessAuditRepository(),
    oidcLinks: new InMemoryOidcIdentityLinkRepository(),
    clock: new SystemClock(),
    logger: silentLogger,
    piiPepper: 'test-pii-pepper',
  });

  // FakeOidcVerifier keys off the raw token string; the values just need to
  // be JWT-shaped (three dot-separated segments) so attachOidcPrincipal's
  // looksLikeJwt() check forwards them to the verifier at all.
  const verifier = new FakeOidcVerifier({
    'header.payload.valid-linked-signature': { subject: 'oidc-sub-1', issuer: ISSUER },
    'header.payload.valid-unlinked-signature': { subject: 'oidc-sub-unknown', issuer: ISSUER },
  });

  const app: Express = express();
  app.use(attachOidcPrincipal({ verifier, rbac }));
  app.get('/whoami', (req, res) => {
    res.json({ principalUserId: req.principalUserId ?? null, authMethod: req.principalAuthMethod ?? null });
  });

  return { app, rbac };
}

describe('attachOidcPrincipal', () => {
  let app: Express;
  let rbac: RbacService;
  let linkedUserId: string;

  beforeEach(async () => {
    const built = build();
    app = built.app;
    rbac = built.rbac;
    const person = await rbac.createPerson({ fullName: 'Admin A', primaryPhone: '+966500000090' });
    const user = await rbac.createUser(person.personId, 'admin');
    await rbac.setUserStatus(user.userId, 'ACTIVATE');
    await rbac.linkOidcIdentity(user.userId, ISSUER, 'oidc-sub-1', 'seed');
    linkedUserId = user.userId;
  });

  it('attaches the RBAC principal for a valid, linked OIDC bearer token', async () => {
    const res = await request(app).get('/whoami').set('Authorization', 'Bearer header.payload.valid-linked-signature');
    expect(res.body).toEqual({ principalUserId: linkedUserId, authMethod: 'oidc' });
  });

  it('leaves the principal unset for a verifiable but unlinked subject', async () => {
    const res = await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer header.payload.valid-unlinked-signature');
    expect(res.body).toEqual({ principalUserId: null, authMethod: null });
  });

  it('leaves the principal unset for an unverifiable token (no throw, just falls through)', async () => {
    const res = await request(app).get('/whoami').set('Authorization', 'Bearer garbage.not.valid');
    expect(res.body).toEqual({ principalUserId: null, authMethod: null });
  });

  it('never calls the verifier for a non-JWT-shaped bearer token (opaque session tokens)', async () => {
    // An opaque session token has no dots — attachOidcPrincipal should skip
    // straight to next() so session-based auth handles it downstream.
    const res = await request(app).get('/whoami').set('Authorization', 'Bearer opaque-session-token-abc123');
    expect(res.body).toEqual({ principalUserId: null, authMethod: null });
  });

  it('is a no-op with no Authorization header at all', async () => {
    const res = await request(app).get('/whoami');
    expect(res.body).toEqual({ principalUserId: null, authMethod: null });
  });
});
