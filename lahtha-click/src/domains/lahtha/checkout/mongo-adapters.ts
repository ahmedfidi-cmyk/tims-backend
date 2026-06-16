// Mongoose checkout adapters + the inventory port wired to the inventory service.

import mongoose, { Schema, type Model } from 'mongoose';
import { FULFILLMENT_TYPES, ORDER_STATES } from './order-state.js';
import type { CurrentOwner, InventoryPort, NewOrder, Order, OrderPatch, OrderRepository } from './types.js';
import type { OrderState } from './order-state.js';
import type { AcquisitionType, OwnerType } from '../inventory/device-state.js';
import { DeviceNotFoundError, type InventoryService } from '../inventory/inventory.service.js';

const orderSchema = new Schema<Order>(
  {
    orderId: { type: String, required: true, unique: true },
    buyerUserId: { type: String, required: true },
    vendorUserId: { type: String, required: true },
    deviceId: { type: String, required: true },
    fulfillmentType: { type: String, required: true, enum: FULFILLMENT_TYPES },
    status: { type: String, required: true, enum: Object.values(ORDER_STATES) },
    subtotalHalalat: { type: Number, required: true },
    commissionHalalat: { type: Number, required: true },
    vendorNetHalalat: { type: Number, required: true },
    totalHalalat: { type: Number, required: true },
    paymentRef: { type: String, default: null },
    shippingRef: { type: String, default: null },
    refundedHalalat: { type: Number, default: null },
    listingId: { type: String, default: null },
    idempotencyKey: { type: String, default: null },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: 'orders', versionKey: false },
);
orderSchema.index({ buyerUserId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
orderSchema.index({ buyerUserId: 1, createdAt: -1 });
orderSchema.index({ vendorUserId: 1, createdAt: -1 });
orderSchema.index({ deviceId: 1 });

const OrderModel: Model<Order> =
  (mongoose.models.Order as Model<Order>) ?? mongoose.model<Order>('Order', orderSchema);

export class MongoOrderRepository implements OrderRepository {
  async create(order: NewOrder): Promise<Order> {
    const doc = await OrderModel.create({ ...order, paymentRef: null, shippingRef: null, refundedHalalat: null });
    return doc.toObject() as Order;
  }
  async findById(orderId: string): Promise<Order | null> {
    return OrderModel.findOne({ orderId }).lean<Order>().exec();
  }
  async findByIdempotencyKey(buyerUserId: string, key: string): Promise<Order | null> {
    return OrderModel.findOne({ buyerUserId, idempotencyKey: key }).lean<Order>().exec();
  }
  async listByBuyer(buyerUserId: string): Promise<Order[]> {
    return OrderModel.find({ buyerUserId }).sort({ createdAt: -1 }).lean<Order[]>().exec();
  }
  async listByVendor(vendorUserId: string): Promise<Order[]> {
    return OrderModel.find({ vendorUserId }).sort({ createdAt: -1 }).lean<Order[]>().exec();
  }
  async updateStatus(orderId: string, expectedFrom: OrderState, patch: OrderPatch): Promise<Order | null> {
    return OrderModel.findOneAndUpdate(
      { orderId, status: expectedFrom },
      { $set: { ...patch, updatedAt: new Date() } },
      { new: true },
    )
      .lean<Order>()
      .exec();
  }
}

/** Adapts the W3 InventoryService to the checkout InventoryPort. */
export class InventoryServicePort implements InventoryPort {
  constructor(private readonly inventory: InventoryService) {}
  async getCurrentOwner(deviceId: string): Promise<CurrentOwner | null> {
    try {
      const view = await this.inventory.getDevice(deviceId);
      if (!view.currentOwner) return null;
      return { ownerId: view.currentOwner.ownerId, ownerType: view.currentOwner.ownerType };
    } catch (err) {
      if (err instanceof DeviceNotFoundError) return null;
      throw err;
    }
  }
  async transferOwnership(
    deviceId: string,
    args: { newOwnerId: string; newOwnerType: OwnerType; acquisitionType: AcquisitionType; sourceEventId?: string },
  ): Promise<void> {
    await this.inventory.transferOwnership(deviceId, args);
  }
}
