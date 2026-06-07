// Public entry point for the inventory (IMEI) domain. Wires Mongo adapters +
// the stub object storage into the service and HTTP router. Authorization is the
// shared IAM session authz, injected by the composition root.

import { Router } from 'express';
import { logger } from '../../../lib/logger.js';
import { InventoryService } from './inventory.service.js';
import { createInventoryRouter } from './inventory.routes.js';
import { SystemClock, StubObjectStorage } from './in-memory-adapters.js';
import {
  MongoDeviceDocumentRepository,
  MongoDeviceOwnershipRepository,
  MongoDeviceRepository,
} from './mongo-adapters.js';
import type { Authz } from '../../iam/authz.js';

export { InventoryService } from './inventory.service.js';
export { createInventoryRouter } from './inventory.routes.js';
export * from './imei.js';
export * from './model-catalog.js';
export * from './device-state.js';
export type * from './types.js';

/** Build the production (Mongo-backed) inventory service. */
export function createInventoryService(): InventoryService {
  const clock = new SystemClock();
  return new InventoryService({
    devices: new MongoDeviceRepository(),
    ownership: new MongoDeviceOwnershipRepository(),
    documents: new MongoDeviceDocumentRepository(),
    storage: new StubObjectStorage('lahtha-device-docs', clock),
    clock,
    logger,
  });
}

/** Build the production inventory router, mounted at /lahtha/inventory. */
export function createLahthaInventoryRouter(authz: Authz): Router {
  return createInventoryRouter(createInventoryService(), authz);
}
