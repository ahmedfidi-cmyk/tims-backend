// Composition root for the IAM domain. Builds one shared RBAC service + identity
// deps (the bridge: identity provisioning and the session principal both route
// through RBAC), then mounts identity, RBAC and session-authz routes under /iam.

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { loadConfig, type Config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { SystemClock } from './in-memory-adapters.js';
import {
  DisabledMfaVerifier,
  LoggingOtpSender,
  MongoOtpChallengeRepository,
  MongoSessionRepository,
  MongoVendorIdentityRepository,
  MongoVendorStatus,
} from './mongo-adapters.js';
import { EntraMfaVerifier } from './entra-mfa-verifier.js';
import { attachOidcPrincipal } from './oidc-authz.js';
import { GenericOidcVerifier, type OidcTokenVerifierPort } from './oidc-verifier.js';
import { RbacVendorAccountProvisioner } from './account-provisioner.js';
import { createIamRouter } from './iam.routes.js';
import { createAuthz, type Authz } from './authz.js';
import type { IamDeps } from './use-cases.js';
import type { MfaVerifierPort, VendorApprovalProvisioner } from './types.js';
import { RbacService } from './rbac/rbac.service.js';
import {
  MongoAccessAuditRepository,
  MongoOidcIdentityLinkRepository,
  MongoPersonRepository,
  MongoRoleGrantRepository,
  MongoUserRepository,
} from './rbac/rbac.mongo.js';
import { createRbacRouter } from './rbac/rbac.routes.js';

function buildMfaVerifier(cfg: Config): MfaVerifierPort {
  if (cfg.ENTRA_TENANT_ID && cfg.ENTRA_CLIENT_ID) {
    return new EntraMfaVerifier({
      tenantId: cfg.ENTRA_TENANT_ID,
      audience: cfg.ENTRA_CLIENT_ID,
      ...(cfg.ENTRA_ISSUER ? { issuer: cfg.ENTRA_ISSUER } : {}),
    });
  }
  return new DisabledMfaVerifier();
}

function buildOidcVerifier(cfg: Config): OidcTokenVerifierPort | null {
  if (!cfg.OIDC_ISSUER || !cfg.OIDC_AUDIENCE) return null;
  return new GenericOidcVerifier({
    issuer: cfg.OIDC_ISSUER,
    audience: cfg.OIDC_AUDIENCE,
    ...(cfg.OIDC_JWKS_URI ? { jwksUri: cfg.OIDC_JWKS_URI } : {}),
    ...(cfg.OIDC_ROLES_CLAIM ? { rolesClaim: cfg.OIDC_ROLES_CLAIM } : {}),
  });
}

/** Build the production (Mongo-backed) RBAC service. Shared across domains. */
export function createRbacService(): RbacService {
  const cfg = loadConfig();
  return new RbacService({
    persons: new MongoPersonRepository(),
    users: new MongoUserRepository(),
    grants: new MongoRoleGrantRepository(),
    audit: new MongoAccessAuditRepository(),
    oidcLinks: new MongoOidcIdentityLinkRepository(),
    clock: new SystemClock(),
    logger,
    piiPepper: cfg.IAM_OTP_PEPPER,
  });
}

/**
 * SSO bearer-authentication middleware, mounted globally (before every domain
 * router — see src/app.ts) so a valid OIDC access token authenticates a
 * request the same way a session cookie does, for any route already gated on
 * `iam.authz.requirePermission(...)`. A no-op passthrough when this
 * deployment has no OIDC IdP configured (OIDC_ISSUER/OIDC_AUDIENCE unset).
 */
export function createOidcAuthzMiddleware(rbac: RbacService) {
  const cfg = loadConfig();
  const verifier = buildOidcVerifier(cfg);
  if (!verifier) {
    return (_req: Request, _res: Response, next: NextFunction): void => next();
  }
  return attachOidcPrincipal({ verifier, rbac });
}

export interface IamModule {
  router: Router;
  /** Session-based authorization, reusable by other domains (e.g. inventory). */
  authz: Authz;
}

export interface IamModuleOptions {
  /** Shared RBAC service (built once in the composition root). */
  rbac: RbacService;
  /** Optional: link a vendor-approval record at signup (shared id). */
  approvalProvisioner?: VendorApprovalProvisioner;
}

/** Build the production IAM module (identity + RBAC + session authz), mounted at /iam. */
export function createIamModule(opts: IamModuleOptions): IamModule {
  const cfg = loadConfig();
  const isProd = cfg.NODE_ENV === 'production';
  const exposeDevCode = !isProd;
  const allowHeaderActor = !isProd; // session principal only in production

  if (isProd && cfg.IAM_OTP_PEPPER === 'dev-otp-pepper-change-me') {
    logger.warn({ event: 'IAM_CONFIG_WARNING' }, 'IAM_OTP_PEPPER is using the insecure default in production');
  }

  const rbac = opts.rbac;

  const iam: IamDeps = {
    identities: new MongoVendorIdentityRepository(),
    otps: new MongoOtpChallengeRepository(),
    sessions: new MongoSessionRepository(),
    vendorStatus: new MongoVendorStatus(),
    provisioner: new RbacVendorAccountProvisioner(rbac),
    ...(opts.approvalProvisioner ? { approvalProvisioner: opts.approvalProvisioner } : {}),
    otpSender: new LoggingOtpSender(logger, exposeDevCode),
    mfa: buildMfaVerifier(cfg),
    clock: new SystemClock(),
    logger,
    otpPepper: cfg.IAM_OTP_PEPPER,
  };

  const authz = createAuthz(iam, rbac);

  const router = Router();
  router.use(createIamRouter(iam, { exposeDevCode, secureCookies: isProd }));
  router.get('/me', authz.me); // session principal + roles + permissions
  // Attach the session principal (if any) before RBAC routes so their permission
  // checks use the session, not a spoofable header.
  router.use(authz.attachPrincipal, createRbacRouter(rbac, { allowHeaderActor }));
  return { router, authz };
}
