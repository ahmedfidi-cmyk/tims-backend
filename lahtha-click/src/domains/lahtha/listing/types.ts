// Listing entities and ports.

import type { ListingStatus } from './listing-state.js';
import type { OwnerType } from '../inventory/device-state.js';

export interface Listing {
  listingId: string;
  deviceId: string;
  vendorUserId: string;
  priceHalalat: number;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewListing {
  listingId: string;
  deviceId: string;
  vendorUserId: string;
  priceHalalat: number;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListingRepository {
  create(listing: NewListing): Promise<Listing>;
  findById(listingId: string): Promise<Listing | null>;
  findActiveByDevice(deviceId: string): Promise<Listing | null>;
  listActive(limit?: number): Promise<Listing[]>;
  listByVendor(vendorUserId: string): Promise<Listing[]>;
  /** Compare-and-set on status (active → sold/withdrawn). */
  updateStatus(listingId: string, expectedFrom: ListingStatus, status: ListingStatus): Promise<Listing | null>;
}

/** Read-only inventory ownership (to verify the lister owns the device). */
export interface InventoryOwnershipPort {
  getCurrentOwner(deviceId: string): Promise<{ ownerId: string; ownerType: OwnerType } | null>;
  /** Optional device summary for browse responses. */
  getDeviceSummary?(deviceId: string): Promise<{ modelName: string; condition: string; imei: string } | null>;
}

export interface Clock {
  now(): Date;
}
export interface AuditLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
}
