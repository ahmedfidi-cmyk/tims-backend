// Listing service — priced vendor offers over ports. No HTTP/Mongoose here.

import { randomUUID } from 'node:crypto';
import {
  INITIAL_LISTING_STATUS,
  LISTING_ACTIONS,
  nextListingStatus,
  type ListingStatus,
} from './listing-state.js';
import type {
  AuditLogger,
  BrowseFilter,
  BrowsePage,
  Clock,
  InventoryOwnershipPort,
  Listing,
  ListingRepository,
  ListingView,
} from './types.js';

export class ListingNotFoundError extends Error {
  constructor(public readonly listingId: string) {
    super(`Listing ${listingId} not found`);
    this.name = 'ListingNotFoundError';
  }
}
export class DeviceNotListableError extends Error {
  constructor(public readonly deviceId: string, public readonly reason: string) {
    super(`Device ${deviceId} cannot be listed: ${reason}`);
    this.name = 'DeviceNotListableError';
  }
}
export class ListingConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ListingConflictError';
  }
}
export class NotListingOwnerError extends Error {
  constructor() {
    super('Only the listing owner may perform this action');
    this.name = 'NotListingOwnerError';
  }
}

export interface ListingDeps {
  listings: ListingRepository;
  inventory: InventoryOwnershipPort;
  clock: Clock;
  logger: AuditLogger;
}

export class ListingService {
  constructor(private readonly deps: ListingDeps) {}

  /** A vendor lists a device they currently own at a price. */
  async createListing(input: { deviceId: string; priceHalalat: number }, vendorUserId: string): Promise<Listing> {
    if (!Number.isInteger(input.priceHalalat) || input.priceHalalat <= 0) {
      throw new DeviceNotListableError(input.deviceId, 'price must be a positive integer (halalat)');
    }
    const owner = await this.deps.inventory.getCurrentOwner(input.deviceId);
    if (!owner) throw new DeviceNotListableError(input.deviceId, 'device not found');
    if (owner.ownerType !== 'vendor' || owner.ownerId !== vendorUserId) {
      throw new DeviceNotListableError(input.deviceId, 'not owned by this vendor');
    }
    if (await this.deps.listings.findActiveByDevice(input.deviceId)) {
      throw new ListingConflictError('device already has an active listing');
    }

    const now = this.deps.clock.now();
    const listing = await this.deps.listings.create({
      listingId: randomUUID(),
      deviceId: input.deviceId,
      vendorUserId,
      priceHalalat: input.priceHalalat,
      status: INITIAL_LISTING_STATUS,
      createdAt: now,
      updatedAt: now,
    });
    this.deps.logger.info(
      { event: 'LISTING_CREATED', listingId: listing.listingId, deviceId: input.deviceId, vendorUserId },
      'listing created',
    );
    return listing;
  }

  async withdraw(listingId: string, byUserId: string, isAdmin = false): Promise<Listing> {
    const listing = await this.requireListing(listingId);
    if (!isAdmin && listing.vendorUserId !== byUserId) throw new NotListingOwnerError();
    return this.transition(listing, LISTING_ACTIONS.WITHDRAW);
  }

  /** Mark sold — called by checkout when an order against the listing completes. */
  async markSold(listingId: string): Promise<Listing> {
    const listing = await this.requireListing(listingId);
    return this.transition(listing, LISTING_ACTIONS.SELL);
  }

  async getById(listingId: string): Promise<Listing> {
    return this.requireListing(listingId);
  }

  listActive(limit?: number): Promise<Listing[]> {
    return this.deps.listings.listActive(limit);
  }
  listByVendor(vendorUserId: string): Promise<Listing[]> {
    return this.deps.listings.listByVendor(vendorUserId);
  }

  /**
   * Browse active listings with a device summary (storefront discovery).
   * Text/condition filters match against the device summary; price filter and
   * sort use the listing. Returns the pre-pagination `total` for the UI.
   */
  async browse(filter: BrowseFilter = {}): Promise<BrowsePage> {
    const listings = await this.deps.listings.listActive();
    let views = await Promise.all(listings.map((listing) => this.withDevice(listing)));

    const q = filter.q?.trim().toLowerCase();
    if (q) views = views.filter((v) => v.device?.modelName.toLowerCase().includes(q));
    if (filter.condition) views = views.filter((v) => v.device?.condition === filter.condition);
    if (typeof filter.minPriceHalalat === 'number') {
      views = views.filter((v) => v.listing.priceHalalat >= filter.minPriceHalalat!);
    }
    if (typeof filter.maxPriceHalalat === 'number') {
      views = views.filter((v) => v.listing.priceHalalat <= filter.maxPriceHalalat!);
    }

    switch (filter.sort) {
      case 'price_asc':
        views.sort((a, b) => a.listing.priceHalalat - b.listing.priceHalalat);
        break;
      case 'price_desc':
        views.sort((a, b) => b.listing.priceHalalat - a.listing.priceHalalat);
        break;
      default: // 'newest'
        views.sort((a, b) => b.listing.createdAt.getTime() - a.listing.createdAt.getTime());
    }

    const total = views.length;
    const limit = Math.min(Math.max(filter.limit ?? 24, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);
    return { items: views.slice(offset, offset + limit), total, limit, offset };
  }

  /** A single listing with its device summary. */
  async getDetailed(listingId: string): Promise<ListingView> {
    return this.withDevice(await this.requireListing(listingId));
  }

  private async withDevice(listing: Listing): Promise<ListingView> {
    const device = this.deps.inventory.getDeviceSummary
      ? await this.deps.inventory.getDeviceSummary(listing.deviceId)
      : null;
    return { listing, device };
  }

  private async transition(listing: Listing, action: typeof LISTING_ACTIONS[keyof typeof LISTING_ACTIONS]): Promise<Listing> {
    const next: ListingStatus = nextListingStatus(listing.status, action);
    const updated = await this.deps.listings.updateStatus(listing.listingId, listing.status, next);
    if (!updated) throw new ListingConflictError(`listing ${listing.listingId} changed concurrently`);
    this.deps.logger.info(
      { event: 'LISTING_TRANSITION', listingId: listing.listingId, action, from: listing.status, to: next },
      'listing transition',
    );
    return updated;
  }

  private async requireListing(listingId: string): Promise<Listing> {
    const l = await this.deps.listings.findById(listingId);
    if (!l) throw new ListingNotFoundError(listingId);
    return l;
  }
}
