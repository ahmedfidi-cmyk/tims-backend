// Public entry point for the RBAC sub-domain. Wires Mongo adapters into the
// service + router for production use.

import { Router } from 'express';
import { loadConfig } from '../../../config/index.js';
import { logger } from '../../../lib/logger.js';
import { SystemClock } from '../in-memory-adapters.js';
import {
  MongoAccessAuditRepository,
  MongoPersonRepository,
  MongoRoleGrantRepository,
  MongoUserRepository,
} from './rbac.mongo.js';
import { RbacService } from './rbac.service.js';
import { createRbacRouter } from './rbac.routes.js';

export { RbacService } from './rbac.service.js';
export { createRbacRouter } from './rbac.routes.js';
export { requirePermission } from './require-permission.js';
export * from './rbac-policy.js';
export type * from './rbac-types.js';

/** Build the production RBAC router, mounted under /iam. */
export function createLahthaRbacRouter(): Router {
  const cfg = loadConfig();
  const service = new RbacService({
    persons: new MongoPersonRepository(),
    users: new MongoUserRepository(),
    grants: new MongoRoleGrantRepository(),
    audit: new MongoAccessAuditRepository(),
    clock: new SystemClock(),
    logger,
    // Reuses the IAM pepper to key national-id hashing in Phase 1; a dedicated
    // KMS-backed pepper is the production follow-up.
    piiPepper: cfg.IAM_OTP_PEPPER,
  });
  return createRbacRouter(service);
}
