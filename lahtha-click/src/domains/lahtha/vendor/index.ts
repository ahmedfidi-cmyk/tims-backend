// Public entry point for the vendor-approval domain.
// Wires the Mongo-backed repositories into the service and HTTP router.

import { Router } from 'express';
import { MongoAuditRepository, MongoVendorRepository } from './mongo-repositories.js';
import { VendorApprovalService } from './vendor.service.js';
import { createVendorRouter } from './vendor.routes.js';

export { VendorApprovalService } from './vendor.service.js';
export { createVendorRouter } from './vendor.routes.js';
export * from './vendor-approval.js';
export type * from './types.js';

/** Build the production (Mongo-backed) vendor router, mounted at /lahtha. */
export function createLahthaVendorRouter(): Router {
  const service = new VendorApprovalService(
    new MongoVendorRepository(),
    new MongoAuditRepository(),
  );
  return createVendorRouter(service);
}
