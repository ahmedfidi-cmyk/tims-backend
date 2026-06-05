// Microsoft Entra ID (Azure AD) OIDC adapter for the MfaVerifierPort.
//
// Verifies an Entra-issued ID token end-to-end: RS256 signature against the
// tenant's JWKS (fetched from the OIDC discovery document and cached), then the
// standard claim checks (iss, aud, exp, nbf, tid). No external JWT library is
// needed — Node's crypto can import a JWK directly and verify RSA-SHA256.
//
// Network is only touched at runtime (discovery + JWKS). Unit tests use the
// FakeMfaVerifier instead, so this adapter never runs in the test suite.

import { createPublicKey, createVerify, type KeyObject } from 'node:crypto';
import { MfaVerificationError, type MfaClaims, type MfaVerifierPort } from './types.js';

export interface EntraConfig {
  tenantId: string;
  /** Expected `aud` — your app's client/application id. */
  audience: string;
  /** Optional override; defaults to the v2.0 issuer for the tenant. */
  issuer?: string;
  /** Claim that carries the LAHTHA vendor id, if your token includes one. */
  vendorIdClaim?: string;
  /** JWKS cache lifetime (ms). */
  jwksTtlMs?: number;
}

interface Jwk {
  kid: string;
  kty: string;
  [k: string]: unknown;
}

function b64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function decodeJson<T>(segment: string): T {
  return JSON.parse(b64urlToBuffer(segment).toString('utf8')) as T;
}

export class EntraMfaVerifier implements MfaVerifierPort {
  private keys = new Map<string, KeyObject>();
  private issuer: string;
  private jwksUri: string | null = null;
  private fetchedAt = 0;
  private readonly ttl: number;

  constructor(private readonly config: EntraConfig) {
    this.issuer = config.issuer ?? `https://login.microsoftonline.com/${config.tenantId}/v2.0`;
    this.ttl = config.jwksTtlMs ?? 60 * 60_000; // 1h
  }

  async verify(idToken: string): Promise<MfaClaims> {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new MfaVerificationError('malformed JWT');
    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    const header = decodeJson<{ alg: string; kid?: string }>(headerB64);
    if (header.alg !== 'RS256') throw new MfaVerificationError(`unsupported alg ${header.alg}`);
    if (!header.kid) throw new MfaVerificationError('missing kid');

    const key = await this.publicKeyFor(header.kid);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    if (!verifier.verify(key, b64urlToBuffer(signatureB64))) {
      throw new MfaVerificationError('signature verification failed');
    }

    const payload = decodeJson<Record<string, unknown>>(payloadB64);
    this.assertClaims(payload);

    const subject = (payload.oid as string) ?? (payload.sub as string);
    if (!subject) throw new MfaVerificationError('missing subject');
    const vendorClaim = this.config.vendorIdClaim ?? 'extension_vendorId';
    const vendorId = typeof payload[vendorClaim] === 'string' ? (payload[vendorClaim] as string) : undefined;

    return { subject, issuer: this.issuer, ...(vendorId ? { vendorId } : {}) };
  }

  private assertClaims(payload: Record<string, unknown>): void {
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.iss !== this.issuer) throw new MfaVerificationError('issuer mismatch');
    const aud = payload.aud;
    const audOk = Array.isArray(aud) ? aud.includes(this.config.audience) : aud === this.config.audience;
    if (!audOk) throw new MfaVerificationError('audience mismatch');
    if (typeof payload.exp === 'number' && nowSec >= payload.exp) {
      throw new MfaVerificationError('token expired');
    }
    if (typeof payload.nbf === 'number' && nowSec < payload.nbf) {
      throw new MfaVerificationError('token not yet valid');
    }
    if (typeof payload.tid === 'string' && payload.tid !== this.config.tenantId) {
      throw new MfaVerificationError('tenant mismatch');
    }
  }

  private async publicKeyFor(kid: string): Promise<KeyObject> {
    if (Date.now() - this.fetchedAt > this.ttl || !this.keys.has(kid)) {
      await this.refreshKeys();
    }
    const key = this.keys.get(kid);
    if (!key) throw new MfaVerificationError(`no signing key for kid ${kid}`);
    return key;
  }

  private async refreshKeys(): Promise<void> {
    if (!this.jwksUri) {
      const discoUrl = `https://login.microsoftonline.com/${this.config.tenantId}/v2.0/.well-known/openid-configuration`;
      const disco = (await fetchJson(discoUrl)) as { jwks_uri?: string; issuer?: string };
      if (!disco.jwks_uri) throw new MfaVerificationError('discovery document missing jwks_uri');
      this.jwksUri = disco.jwks_uri;
      if (disco.issuer && !this.config.issuer) this.issuer = disco.issuer;
    }
    const jwks = (await fetchJson(this.jwksUri)) as { keys?: Jwk[] };
    this.keys = new Map();
    for (const jwk of jwks.keys ?? []) {
      try {
        this.keys.set(jwk.kid, createPublicKey({ key: jwk as never, format: 'jwk' }));
      } catch {
        // Skip keys Node can't import (non-RSA, etc.).
      }
    }
    this.fetchedAt = Date.now();
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new MfaVerificationError(`fetch ${url} failed: ${res.status}`);
  return res.json();
}
