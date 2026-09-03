// OIDC bearer-token authentication — attaches an RBAC principal resolved from
// a verified SSO token, so downstream `requirePermission` checks (session or
// SSO) look identical. Mounted globally, before session authz, so any domain
// route already gated on `iam.authz.requirePermission(...)` gets SSO support
// for free (see src/app.ts).
//
// Deliberately best-effort and fail-open-to-the-next-layer: an invalid,
// unverifiable, or unlinked OIDC token leaves the principal unset rather than
// rejecting the request outright, so a session cookie can still authenticate
// it. The trade-off is a generic 401 "unauthenticated" (from whichever layer
// runs next) instead of a specific "your SSO token is invalid" — acceptable
// here since this mirrors `authz.attachPrincipal`'s existing best-effort
// pattern, and the alternative (rejecting immediately) would also incorrectly
// reject a request that carries a stale bearer token alongside a valid
// session cookie.

import type { NextFunction, Request, Response } from 'express';
import { bearerToken } from './http-token.js';
import type { OidcTokenVerifierPort } from './oidc-verifier.js';
import type { RbacService } from './rbac/rbac.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** How principalUserId was resolved, for audit/debugging — unset until an
     * authz layer (this middleware, or session resolution) sets a principal. */
    principalAuthMethod?: 'session' | 'oidc';
  }
}

export interface OidcAuthzOptions {
  verifier: OidcTokenVerifierPort;
  rbac: RbacService;
}

/** Session tokens are opaque; only JWTs have this 3-segment shape. Used to
 * decide whether a bearer token is even worth sending to the OIDC verifier. */
function looksLikeJwt(token: string): boolean {
  return token.split('.').length === 3;
}

export function attachOidcPrincipal(opts: OidcAuthzOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = bearerToken(req);
    if (!token || !looksLikeJwt(token)) {
      next();
      return;
    }
    opts.verifier
      .verify(token)
      .then((claims) => opts.rbac.resolveOidcPrincipal(claims.issuer, claims.subject))
      .then((user) => {
        if (user) {
          req.principalUserId = user.userId;
          req.principalAuthMethod = 'oidc';
        }
      })
      .catch(() => {
        // Invalid signature/claims, or a verified subject with no linked RBAC
        // user: leave the principal unset. Session resolution or
        // requirePermission's 401 handles the eventual rejection.
      })
      .finally(() => next());
  };
}
