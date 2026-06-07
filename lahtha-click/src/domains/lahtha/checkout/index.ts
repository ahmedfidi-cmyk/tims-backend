// Public entry point for the checkout domain. Wires the Mongo order repo + the
// inventory port (over the W3 inventory service) into the service and router.
// Authorization is the shared IAM session authz.

import { Router } from 'express';
import { logger } from '../../../lib/logger.js';
import { CheckoutService } from './checkout.service.js';
import { createCheckoutRouter } from './checkout.routes.js';
import { SystemClock } from './in-memory-adapters.js';
import { InventoryServicePort, MongoOrderRepository } from './mongo-adapters.js';
import { createInventoryService } from '../inventory/index.js';
import type { Authz } from '../../iam/authz.js';

export { CheckoutService } from './checkout.service.js';
export { createCheckoutRouter } from './checkout.routes.js';
export * from './order-state.js';
export * from './order-money.js';
export type * from './types.js';

/** Build the production checkout router, mounted at /lahtha. */
export function createLahthaCheckoutRouter(authz: Authz): Router {
  const service = new CheckoutService({
    orders: new MongoOrderRepository(),
    inventory: new InventoryServicePort(createInventoryService()),
    clock: new SystemClock(),
    logger,
  });
  return createCheckoutRouter(service, authz);
}
