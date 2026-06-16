// Checkout entities and ports. The inventory coupling is an in-process port
// (both domains are LAHTHA), not the sync_events bus.

import type { FulfillmentType, OrderState } from './order-state.js';
import type { OwnerType, AcquisitionType } from '../inventory/device-state.js';

export interface Order {
  orderId: string;
  buyerUserId: string;
  vendorUserId: string;
  deviceId: string;
  fulfillmentType: FulfillmentType;
  status: OrderState;
  subtotalHalalat: number;
  commissionHalalat: number;
  vendorNetHalalat: number;
  totalHalalat: number;
  paymentRef: string | null;
  shippingRef: string | null;
  refundedHalalat: number | null;
  /** Listing this order was placed from (storefront path), if any. */
  listingId: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewOrder {
  orderId: string;
  buyerUserId: string;
  vendorUserId: string;
  deviceId: string;
  fulfillmentType: FulfillmentType;
  status: OrderState;
  subtotalHalalat: number;
  commissionHalalat: number;
  vendorNetHalalat: number;
  totalHalalat: number;
  listingId: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderPatch {
  status?: OrderState;
  paymentRef?: string | null;
  shippingRef?: string | null;
  refundedHalalat?: number | null;
}

export interface OrderRepository {
  create(order: NewOrder): Promise<Order>;
  findById(orderId: string): Promise<Order | null>;
  findByIdempotencyKey(buyerUserId: string, key: string): Promise<Order | null>;
  listByBuyer(buyerUserId: string): Promise<Order[]>;
  listByVendor(vendorUserId: string): Promise<Order[]>;
  /** Compare-and-set on status to guard against double transitions. */
  updateStatus(orderId: string, expectedFrom: OrderState, patch: OrderPatch): Promise<Order | null>;
}

export interface CurrentOwner {
  ownerId: string;
  ownerType: OwnerType;
}

/** In-process bridge to the inventory domain (ownership). */
export interface InventoryPort {
  getCurrentOwner(deviceId: string): Promise<CurrentOwner | null>;
  transferOwnership(
    deviceId: string,
    args: {
      newOwnerId: string;
      newOwnerType: OwnerType;
      acquisitionType: AcquisitionType;
      sourceEventId?: string;
    },
  ): Promise<void>;
}

/** Read a purchasable listing (storefront placement). */
export interface ListingQueryPort {
  getActiveListing(listingId: string): Promise<{ deviceId: string; vendorUserId: string; priceHalalat: number } | null>;
}

/** Mark a listing sold when its order completes. */
export interface ListingSoldPort {
  onOrderCompleted(listingId: string): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface AuditLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
}
