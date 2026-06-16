// Public entry point for the listing domain.

import { Router } from 'express';
import { logger } from '../../../lib/logger.js';
import { ListingNotFoundError, ListingService } from './listing.service.js';
import { createListingRouter } from './listing.routes.js';
import { SystemClock } from './in-memory-adapters.js';
import { InventoryOwnershipAdapter, MongoListingRepository } from './mongo-adapters.js';
import { createInventoryService } from '../inventory/index.js';
import type { Authz } from '../../iam/authz.js';

export { ListingService } from './listing.service.js';
export { createListingRouter } from './listing.routes.js';
export * from './listing-state.js';
export type * from './types.js';

/** Build the production listing service (shares the inventory service for ownership). */
export function createListingService(): ListingService {
  return new ListingService({
    listings: new MongoListingRepository(),
    inventory: new InventoryOwnershipAdapter(createInventoryService()),
    clock: new SystemClock(),
    logger,
  });
}

/** ListingQueryPort for checkout: resolve an active listing for placement. */
export function makeListingQueryPort(
  service: ListingService,
): { getActiveListing(listingId: string): Promise<{ deviceId: string; vendorUserId: string; priceHalalat: number } | null> } {
  return {
    async getActiveListing(listingId: string) {
      try {
        const l = await service.getById(listingId);
        if (l.status !== 'active') return null;
        return { deviceId: l.deviceId, vendorUserId: l.vendorUserId, priceHalalat: l.priceHalalat };
      } catch (err) {
        if (err instanceof ListingNotFoundError) return null;
        throw err;
      }
    },
  };
}

/** ListingSoldPort for checkout: mark a listing sold on order completion. */
export function makeListingSoldPort(service: ListingService): { onOrderCompleted(listingId: string): Promise<void> } {
  return {
    async onOrderCompleted(listingId: string) {
      await service.markSold(listingId);
    },
  };
}

/** Build the production listing router, mounted at /lahtha. */
export function createLahthaListingRouter(service: ListingService, authz: Authz): Router {
  return createListingRouter(service, authz);
}
