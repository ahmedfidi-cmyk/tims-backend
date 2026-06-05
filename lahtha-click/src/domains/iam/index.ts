// Public entry point for the IAM (identity + session) domain.
// Wires production adapters (Mongo + Entra) into the use cases and HTTP router.

import { Router } from 'express';
import { loadConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import {
  DisabledMfaVerifier,
  LoggingOtpSender,
  MongoOtpChallengeRepository,
  MongoSessionRepository,
  MongoVendorIdentityRepository,
  MongoVendorStatus,
} from './mongo-adapters.js';
import { EntraMfaVerifier } from './entra-mfa-verifier.js';
import { SystemClock } from './in-memory-adapters.js';
import { createIamRouter } from './iam.routes.js';
import type { IamDeps } from './use-cases.js';
import type { MfaVerifierPort } from './types.js';

export { createIamRouter } from './iam.routes.js';
export * from './use-cases.js';
export * from './scopes.js';
export type * from './types.js';

function buildMfaVerifier(): MfaVerifierPort {
  const cfg = loadConfig();
  if (cfg.ENTRA_TENANT_ID && cfg.ENTRA_CLIENT_ID) {
    return new EntraMfaVerifier({
      tenantId: cfg.ENTRA_TENANT_ID,
      audience: cfg.ENTRA_CLIENT_ID,
      ...(cfg.ENTRA_ISSUER ? { issuer: cfg.ENTRA_ISSUER } : {}),
    });
  }
  return new DisabledMfaVerifier();
}

/** Build the production IAM router, mounted at /iam. */
export function createLahthaIamRouter(): Router {
  const cfg = loadConfig();
  const isProd = cfg.NODE_ENV === 'production';
  const exposeDevCode = !isProd;

  if (isProd && cfg.IAM_OTP_PEPPER === 'dev-otp-pepper-change-me') {
    logger.warn({ event: 'IAM_CONFIG_WARNING' }, 'IAM_OTP_PEPPER is using the insecure default in production');
  }

  const deps: IamDeps = {
    identities: new MongoVendorIdentityRepository(),
    otps: new MongoOtpChallengeRepository(),
    sessions: new MongoSessionRepository(),
    vendorStatus: new MongoVendorStatus(),
    otpSender: new LoggingOtpSender(logger, exposeDevCode),
    mfa: buildMfaVerifier(),
    clock: new SystemClock(),
    logger,
    otpPepper: cfg.IAM_OTP_PEPPER,
  };

  return createIamRouter(deps, { exposeDevCode, secureCookies: isProd });
}
