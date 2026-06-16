// In-memory listing adapters for tests + reference.

import type { ListingStatus } from './listing-state.js';
import type { Clock, InventoryOwnershipPort, Listing, ListingRepository, NewListing } from './types.js';
import type { OwnerType } from '../inventory/device-state.js';

export class InMemoryListingRepository implements ListingRepository {
  private readonly byId = new Map<string, Listing>();

  async create(listing: NewListing): Promise<Listing> {
    this.byId.set(listing.listingId, { ...listing });
    return { ...listing };
  }
  async findById(listingId: string): Promise<Listing | null> {
    const l = this.byId.get(listingId);
    return l ? { ...l } : null;
  }
  async findActiveByDevice(deviceId: string): Promise<Listing | null> {
    for (const l of this.byId.values()) if (l.deviceId === deviceId && l.status === 'active') return { ...l };
    return null;
  }
  async listActive(limit = 100): Promise<Listing[]> {
    return [...this.byId.values()]
      .filter((l) => l.status === 'active')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((l) => ({ ...l }));
  }
  async listByVendor(vendorUserId: string): Promise<Listing[]> {
    return [...this.byId.values()].filter((l) => l.vendorUserId === vendorUserId).map((l) => ({ ...l }));
  }
  async updateStatus(listingId: string, expectedFrom: ListingStatus, status: ListingStatus): Promise<Listing | null> {
    const l = this.byId.get(listingId);
    if (!l || l.status !== expectedFrom) return null;
    const updated: Listing = { ...l, status, updatedAt: new Date() };
    this.byId.set(listingId, updated);
    return { ...updated };
  }
}

/** Configurable inventory ownership for tests. */
export class FakeInventoryOwnership implements InventoryOwnershipPort {
  private readonly owners = new Map<string, { ownerId: string; ownerType: OwnerType }>();
  private readonly summaries = new Map<string, { modelName: string; condition: string; imei: string }>();
  setOwner(deviceId: string, owner: { ownerId: string; ownerType: OwnerType }): void {
    this.owners.set(deviceId, owner);
  }
  setSummary(deviceId: string, summary: { modelName: string; condition: string; imei: string }): void {
    this.summaries.set(deviceId, summary);
  }
  async getCurrentOwner(deviceId: string) {
    return this.owners.get(deviceId) ?? null;
  }
  async getDeviceSummary(deviceId: string) {
    return this.summaries.get(deviceId) ?? null;
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
