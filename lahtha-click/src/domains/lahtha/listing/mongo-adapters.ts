// Mongoose listing adapter + the inventory ownership port over the W3 service.

import mongoose, { Schema, type Model } from 'mongoose';
import { LISTING_STATUSES, type ListingStatus } from './listing-state.js';
import type { InventoryOwnershipPort, Listing, ListingRepository, NewListing } from './types.js';
import { DeviceNotFoundError, type InventoryService } from '../inventory/inventory.service.js';

const listingSchema = new Schema<Listing>(
  {
    listingId: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    vendorUserId: { type: String, required: true },
    priceHalalat: { type: Number, required: true },
    status: { type: String, required: true, enum: LISTING_STATUSES },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: 'listings', versionKey: false },
);
// At most one active listing per device.
listingSchema.index({ deviceId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
listingSchema.index({ vendorUserId: 1, createdAt: -1 });
listingSchema.index({ status: 1, createdAt: -1 });

const ListingModel: Model<Listing> =
  (mongoose.models.Listing as Model<Listing>) ?? mongoose.model<Listing>('Listing', listingSchema);

export class MongoListingRepository implements ListingRepository {
  async create(listing: NewListing): Promise<Listing> {
    const doc = await ListingModel.create(listing);
    return doc.toObject() as Listing;
  }
  async findById(listingId: string): Promise<Listing | null> {
    return ListingModel.findOne({ listingId }).lean<Listing>().exec();
  }
  async findActiveByDevice(deviceId: string): Promise<Listing | null> {
    return ListingModel.findOne({ deviceId, status: 'active' }).lean<Listing>().exec();
  }
  async listActive(limit = 100): Promise<Listing[]> {
    return ListingModel.find({ status: 'active' }).sort({ createdAt: -1 }).limit(limit).lean<Listing[]>().exec();
  }
  async listByVendor(vendorUserId: string): Promise<Listing[]> {
    return ListingModel.find({ vendorUserId }).sort({ createdAt: -1 }).lean<Listing[]>().exec();
  }
  async updateStatus(listingId: string, expectedFrom: ListingStatus, status: ListingStatus): Promise<Listing | null> {
    return ListingModel.findOneAndUpdate(
      { listingId, status: expectedFrom },
      { $set: { status, updatedAt: new Date() } },
      { new: true },
    )
      .lean<Listing>()
      .exec();
  }
}

/** Adapts the W3 InventoryService to the listing ownership port. */
export class InventoryOwnershipAdapter implements InventoryOwnershipPort {
  constructor(private readonly inventory: InventoryService) {}
  async getCurrentOwner(deviceId: string) {
    try {
      const view = await this.inventory.getDevice(deviceId);
      return view.currentOwner ? { ownerId: view.currentOwner.ownerId, ownerType: view.currentOwner.ownerType } : null;
    } catch (err) {
      if (err instanceof DeviceNotFoundError) return null;
      throw err;
    }
  }
}
