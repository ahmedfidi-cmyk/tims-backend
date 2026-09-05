// Generic OIDC bearer-token verifier — SSO authentication (distinct from
// EntraMfaVerifier, which verifies an Entra ID token for MFA step-up only).
//
// Verifies an OIDC access/ID token end-to-end: RS256 signature against the
// issuer's JWKS (via OIDC discovery, cached), then standard claims (iss, aud,
// exp, nbf). Works with any standard OIDC provider (Keycloak, Cognito, Auth0,
// Entra, Okta, ...) since it only relies on the OIDC discovery + JWKS spec,
// not a provider-specific claim shape. No external JWT library is needed —
// Node's crypto can import a JWK directly and verify RSA-SHA256.
//
// Deliberately NOT sharing code with entra-mfa-verifier.ts: that file has no
// unit test coverage (network-dependent, by its own comment), so refactoring
// it to share primitives with this new path would risk a silent regression
// in the existing (working) Entra MFA step-up flow for a purely cosmetic DRY
// win. The JWT/JWKS mechanics below are intentionally duplicated in miniature;
// if a real second consumer of Entra's own logic ever appears, extract then.

import { createPublicKey, createVerify, type KeyObject } from 'node:crypto';

export interface OidcClaims {
  subject: string;
  issuer: string;
  email?: string;
  /** Values of the configured roles claim, when present and an array of strings. */
  roles?: string[];
}

export interface OidcTokenVerifierPort {
  verify(token: string): Promise<OidcClaims>;
}

export class OidcVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OidcVerificationError';
  }
}

export interface OidcVerifierConfig {
  /** Expected `iss` claim. Also used to derive the discovery URL
   * (`${issuer}/.well-known/openid-configuration`) unless jwksUri is set. */
  issuer: string;
  /** Expected `aud` claim (this app's client/resource id at the IdP). */
  audience: string;
  /** Override the discovered JWKS endpoint (skips discovery entirely). */
  jwksUri?: string;
  /** Claim name carrying role/group strings, if the IdP embeds them. */
  rolesClaim?: string;
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

/**
 * Verifies bearer tokens issued by any standard OIDC provider, for SSO
 * authentication of interactive principals (docs/architecture/iam-rbac.md:
 * `admin` principals are SSO-only, hard-provisioned). This class only proves
 * "who the IdP says this is" — resolving that verified (issuer, subject) pair
 * to a local RBAC user is a separate, explicit step (see
 * RbacService.resolveOidcPrincipal / linkOidcIdentity), never automatic.
 */
export class GenericOidcVerifier implements OidcTokenVerifierPort {
  private keys = new Map<string, KeyObject>();
  private jwksUri: string | null;
  private fetchedAt = 0;
  private readonly ttl: number;
  private readonly rolesClaim: string;

  constructor(private readonly config: OidcVerifierConfig) {
    this.jwksUri = config.jwksUri ?? null;
    this.ttl = config.jwksTtlMs ?? 60 * 60_000; // 1h
    this.rolesClaim = config.rolesClaim ?? 'roles';
  }

  async verify(token: string): Promise<OidcClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new OidcVerificationError('malformed JWT');
    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    const header = decodeJson<{ alg: string; kid?: string }>(headerB64);
    if (header.alg !== 'RS256') throw new OidcVerificationError(`unsupported alg ${header.alg}`);
    if (!header.kid) throw new OidcVerificationError('missing kid');

    const key = await this.publicKeyFor(header.kid);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    if (!verifier.verify(key, b64urlToBuffer(signatureB64))) {
      throw new OidcVerificationError('signature verification failed');
    }

    const payload = decodeJson<Record<string, unknown>>(payloadB64);
    this.assertClaims(payload);

    const subject = payload.sub as string | undefined;
    if (!subject) throw new OidcVerificationError('missing subject');
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const rawRoles = payload[this.rolesClaim];
    const roles =
      Array.isArray(rawRoles) && rawRoles.every((r) => typeof r === 'string') ? (rawRoles as string[]) : undefined;

    return { subject, issuer: this.config.issuer, ...(email ? { email } : {}), ...(roles ? { roles } : {}) };
  }

  private assertClaims(payload: Record<string, unknown>): void {
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.iss !== this.config.issuer) throw new OidcVerificationError('issuer mismatch');
    const aud = payload.aud;
    const audOk = Array.isArray(aud) ? aud.includes(this.config.audience) : aud === this.config.audience;
    if (!audOk) throw new OidcVerificationError('audience mismatch');
    if (typeof payload.exp === 'number' && nowSec >= payload.exp) {
      throw new OidcVerificationError('token expired');
    }
    if (typeof payload.nbf === 'number' && nowSec < payload.nbf) {
      throw new OidcVerificationError('token not yet valid');
    }
  }

  private async publicKeyFor(kid: string): Promise<KeyObject> {
    if (Date.now() - this.fetchedAt > this.ttl || !this.keys.has(kid)) {
      await this.refreshKeys();
    }
    const key = this.keys.get(kid);
    if (!key) throw new OidcVerificationError(`no signing key for kid ${kid}`);
    return key;
  }

  private async refreshKeys(): Promise<void> {
    if (!this.jwksUri) {
      const discoUrl = `${this.config.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
      const disco = (await fetchJson(discoUrl)) as { jwks_uri?: string };
      if (!disco.jwks_uri) throw new OidcVerificationError('discovery document missing jwks_uri');
      this.jwksUri = disco.jwks_uri;
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
  if (!res.ok) throw new OidcVerificationError(`fetch ${url} failed: ${res.status}`);
  return res.json();
}
