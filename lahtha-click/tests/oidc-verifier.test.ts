// Real RS256 crypto exercised end-to-end: generate a keypair, sign a JWT by
// hand (no JWT library — matches the production code's own approach), serve
// it from a faked `fetch` as an OIDC discovery doc + JWKS, and confirm
// GenericOidcVerifier accepts a valid token and rejects every way it can be
// wrong. Unlike EntraMfaVerifier (network-dependent, untested by design),
// this class is fully exercisable without a real IdP.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { GenericOidcVerifier, OidcVerificationError } from '../src/domains/iam/oidc-verifier.js';

const ISSUER = 'https://idp.example.test';
const AUDIENCE = 'lahtha-click';
const KID = 'test-key-1';

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signJwt(payload: Record<string, unknown>, privateKey: KeyObject, kid = KID, alg = 'RS256'): string {
  const header = { alg, kid, typ: 'JWT' };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${signingInput}.${b64url(signature)}`;
}

describe('GenericOidcVerifier', () => {
  let publicJwk: Record<string, unknown>;
  let privateKey: KeyObject;
  let fetchMock: ReturnType<typeof vi.fn>;
  let nowSec: number;

  beforeEach(() => {
    const { publicKey, privateKey: priv } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = priv;
    publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' };
    nowSec = Math.floor(Date.now() / 1000);

    fetchMock = vi.fn(async (url: string) => {
      if (url === `${ISSUER}/.well-known/openid-configuration`) {
        return {
          ok: true,
          json: async () => ({ jwks_uri: `${ISSUER}/jwks.json` }),
        };
      }
      if (url === `${ISSUER}/jwks.json`) {
        return { ok: true, json: async () => ({ keys: [publicJwk] }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function verifier(overrides: Partial<{ jwksUri: string; rolesClaim: string }> = {}) {
    return new GenericOidcVerifier({ issuer: ISSUER, audience: AUDIENCE, ...overrides });
  }

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      iss: ISSUER,
      aud: AUDIENCE,
      sub: 'user-123',
      exp: nowSec + 3600,
      iat: nowSec,
      ...overrides,
    };
  }

  it('verifies a well-formed token via discovery + JWKS', async () => {
    const token = signJwt(validPayload({ email: 'admin@example.test' }), privateKey);
    const claims = await verifier().verify(token);
    expect(claims).toMatchObject({ subject: 'user-123', issuer: ISSUER, email: 'admin@example.test' });
    // Discovery + JWKS each fetched once.
    expect(fetchMock).toHaveBeenCalledWith(`${ISSUER}/.well-known/openid-configuration`);
    expect(fetchMock).toHaveBeenCalledWith(`${ISSUER}/jwks.json`);
  });

  it('caches keys across calls (discovery + JWKS fetched only once)', async () => {
    const token = signJwt(validPayload(), privateKey);
    await verifier().verify(token);
    const v = verifier();
    await v.verify(signJwt(validPayload(), privateKey));
    await v.verify(signJwt(validPayload(), privateKey));
    // 2 fetches for the first verifier's cold cache + 2 for the second's — not 6.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('skips discovery entirely when jwksUri is configured directly', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === `${ISSUER}/custom-jwks.json`) return { ok: true, json: async () => ({ keys: [publicJwk] }) };
      throw new Error(`unexpected fetch ${url}`);
    });
    const token = signJwt(validPayload(), privateKey);
    const claims = await verifier({ jwksUri: `${ISSUER}/custom-jwks.json` }).verify(token);
    expect(claims.subject).toBe('user-123');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('extracts a configured roles claim when present', async () => {
    const token = signJwt(validPayload({ groups: ['admin.ops', 'admin.support'] }), privateKey);
    const claims = await verifier({ rolesClaim: 'groups' }).verify(token);
    expect(claims.roles).toEqual(['admin.ops', 'admin.support']);
  });

  it('rejects a token signed by an unknown key', async () => {
    const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const token = signJwt(validPayload(), otherKey); // signed with a key not in the JWKS
    await expect(verifier().verify(token)).rejects.toThrow(OidcVerificationError);
  });

  it('rejects a tampered payload (signature no longer matches)', async () => {
    const token = signJwt(validPayload(), privateKey);
    const [h, p, s] = token.split('.');
    const tamperedPayload = b64url(JSON.stringify(validPayload({ sub: 'attacker' })));
    await expect(verifier().verify(`${h}.${tamperedPayload}.${s}`)).rejects.toThrow(OidcVerificationError);
  });

  it('rejects an issuer mismatch', async () => {
    const token = signJwt(validPayload({ iss: 'https://not-the-idp.test' }), privateKey);
    await expect(verifier().verify(token)).rejects.toThrow(/issuer mismatch/);
  });

  it('rejects an audience mismatch', async () => {
    const token = signJwt(validPayload({ aud: 'someone-else' }), privateKey);
    await expect(verifier().verify(token)).rejects.toThrow(/audience mismatch/);
  });

  it('accepts an audience array containing this app', async () => {
    const token = signJwt(validPayload({ aud: ['other-app', AUDIENCE] }), privateKey);
    await expect(verifier().verify(token)).resolves.toMatchObject({ subject: 'user-123' });
  });

  it('rejects an expired token', async () => {
    const token = signJwt(validPayload({ exp: nowSec - 10 }), privateKey);
    await expect(verifier().verify(token)).rejects.toThrow(/expired/);
  });

  it('rejects a not-yet-valid token', async () => {
    const token = signJwt(validPayload({ nbf: nowSec + 600 }), privateKey);
    await expect(verifier().verify(token)).rejects.toThrow(/not yet valid/);
  });

  it('rejects an unsupported algorithm', async () => {
    const header = b64url(JSON.stringify({ alg: 'none', kid: KID }));
    const payload = b64url(JSON.stringify(validPayload()));
    await expect(verifier().verify(`${header}.${payload}.`)).rejects.toThrow(/unsupported alg/);
  });

  it('rejects a malformed token', async () => {
    await expect(verifier().verify('not-a-jwt')).rejects.toThrow(/malformed JWT/);
  });

  it('rejects when the discovery document has no jwks_uri', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({}) }));
    const token = signJwt(validPayload(), privateKey);
    await expect(verifier().verify(token)).rejects.toThrow(/missing jwks_uri/);
  });
});
