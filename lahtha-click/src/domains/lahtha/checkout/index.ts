// Public entry point for the checkout domain. Wires the Mongo order repo + the
// inventory port (over the W3 inventory service) into the service and router.
// Authorization is the shared IAM session authz.

import { Router } from 'express';
import { logger } from '../../../lib/logger.js';
import { CheckoutService } from './checkout.service.js';
import { createCheckoutRouter } from './checkout.routes.js';
import { SystemClock } from './in-memory-adapters.js';
import { InventoryServicePort, MongoOrderRepository, RbacVendorCountPort } from './mongo-adapters.js';
import { createInventoryService } from '../inventory/index.js';
import type { Authz } from '../../iam/authz.js';
import type { RbacService } from '../../iam/rbac/rbac.service.js';
import type { ListingQueryPort, ListingSoldPort } from './types.js';

export { CheckoutService } from './checkout.service.js';
export { createCheckoutRouter } from './checkout.routes.js';
export * from './order-state.js';
export * from './order-money.js';
export type * from './types.js';

export interface CheckoutWiring {
  listings?: ListingQueryPort;
  listingSold?: ListingSoldPort;
  /** Admin analytics: resolves active-vendor counts over RBAC. */
  rbac?: RbacService;
}

/** Build the production (Mongo-backed) checkout service. */
export function createCheckoutService(wiring: CheckoutWiring = {}): CheckoutService {
  return new CheckoutService({
    orders: new MongoOrderRepository(),
    inventory: new InventoryServicePort(createInventoryService()),
    ...(wiring.listings ? { listings: wiring.listings } : {}),
    ...(wiring.listingSold ? { listingSold: wiring.listingSold } : {}),
    ...(wiring.rbac ? { vendorCount: new RbacVendorCountPort(wiring.rbac) } : {}),
    clock: new SystemClock(),
    logger,
  });
}

/** Build the production checkout router, mounted at /lahtha. */
export function createLahthaCheckoutRouter(service: CheckoutService, authz: Authz): Router {
  return createCheckoutRouter(service, authz);
}
