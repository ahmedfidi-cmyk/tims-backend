// Public entry point for the inventory (IMEI) domain. Wires Mongo adapters +
// the stub object storage into the service and HTTP router. Authorization is the
// shared IAM session authz, injected by the composition root.

import { Router } from 'express';
import { logger } from '../../../lib/logger.js';
import { loadConfig, type Config } from '../../../config/index.js';
import { InventoryService } from './inventory.service.js';
import { createInventoryRouter } from './inventory.routes.js';
import { SystemClock, StubObjectStorage } from './in-memory-adapters.js';
import { S3ObjectStorage, StorageNotConfiguredError } from './s3-storage.js';
import {
  MongoDeviceDocumentRepository,
  MongoDeviceOwnershipRepository,
  MongoDeviceRepository,
} from './mongo-adapters.js';
import type { Authz } from '../../iam/authz.js';
import type { Clock, ObjectStoragePort } from './types.js';

export { InventoryService } from './inventory.service.js';
export { createInventoryRouter } from './inventory.routes.js';
export { S3ObjectStorage, StorageNotConfiguredError } from './s3-storage.js';
export * from './imei.js';
export * from './model-catalog.js';
export * from './device-state.js';
export type * from './types.js';

/**
 * Choose the object-storage adapter. Uses S3 when fully configured; outside
 * production falls back to the dev stub. In production a stub is REFUSED — the
 * storage seam fails closed rather than minting unusable presigned URLs.
 */
export function buildObjectStorage(config: Config, clock: Clock): ObjectStoragePort {
  const hasS3 = Boolean(
    config.S3_BUCKET && config.S3_REGION && config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY,
  );
  const driver = config.STORAGE_DRIVER ?? (hasS3 ? 's3' : 'stub');

  if (driver === 's3') {
    if (!hasS3) throw new StorageNotConfiguredError();
    return new S3ObjectStorage(
      {
        bucket: config.S3_BUCKET!,
        region: config.S3_REGION!,
        accessKeyId: config.S3_ACCESS_KEY_ID!,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
        ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
        ...(config.S3_UPLOAD_EXPIRES_SECONDS ? { expiresSeconds: config.S3_UPLOAD_EXPIRES_SECONDS } : {}),
      },
      clock,
    );
  }

  if (config.NODE_ENV === 'production') throw new StorageNotConfiguredError();
  return new StubObjectStorage(config.S3_BUCKET ?? 'lahtha-device-docs-dev', clock);
}

/** Build the production (Mongo-backed) inventory service. */
export function createInventoryService(): InventoryService {
  const clock = new SystemClock();
  return new InventoryService({
    devices: new MongoDeviceRepository(),
    ownership: new MongoDeviceOwnershipRepository(),
    documents: new MongoDeviceDocumentRepository(),
    storage: buildObjectStorage(loadConfig(), clock),
    clock,
    logger,
  });
}

/** Build the production inventory router, mounted at /lahtha/inventory. */
export function createLahthaInventoryRouter(authz: Authz): Router {
  return createInventoryRouter(createInventoryService(), authz);
}
