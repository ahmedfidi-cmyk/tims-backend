// Checkout service — order lifecycle over ports. Reuses the pure state machine
// and money core; transfers device ownership through the inventory port at the
// right transitions. No HTTP/Mongoose here.

import { randomUUID } from 'node:crypto';
import { computeOrderMoney, computeRefundReversal } from './order-money.js';
import {
  INITIAL_ORDER_STATE,
  ORDER_ACTIONS,
  ORDER_STATES,
  nextOrderState,
  type OrderAction,
  type OrderState,
} from './order-state.js';
import type {
  AuditLogger,
  Clock,
  InventoryPort,
  ListingQueryPort,
  ListingSoldPort,
  Order,
  OrderPatch,
  OrderRepository,
} from './types.js';
import type { PlaceOrderInput } from './schemas.js';

/** Sentinel owner id for devices held under a digital-custody agreement. */
export const LAHTHA_CUSTODY_OWNER = 'LAHTHA_CUSTODY';

export interface CheckoutDeps {
  orders: OrderRepository;
  inventory: InventoryPort;
  /** Storefront placement: resolve a purchasable listing. */
  listings?: ListingQueryPort;
  /** Mark a listing sold when its order completes. */
  listingSold?: ListingSoldPort;
  clock: Clock;
  logger: AuditLogger;
}

export class ListingUnavailableError extends Error {
  constructor(public readonly listingId: string) {
    super(`Listing ${listingId} is not available`);
    this.name = 'ListingUnavailableError';
  }
}

// --- Errors ---
export class OrderNotFoundError extends Error {
  constructor(public readonly orderId: string) {
    super(`Order ${orderId} not found`);
    this.name = 'OrderNotFoundError';
  }
}
export class DeviceUnavailableError extends Error {
  constructor(public readonly deviceId: string, public readonly reason: string) {
    super(`Device ${deviceId} is not available: ${reason}`);
    this.name = 'DeviceUnavailableError';
  }
}
export class OrderConflictError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} was modified concurrently; retry`);
    this.name = 'OrderConflictError';
  }
}
export class NotOrderOwnerError extends Error {
  constructor() {
    super('Only the buyer may perform this action');
    this.name = 'NotOrderOwnerError';
  }
}
export class NotSellingVendorError extends Error {
  constructor() {
    super('Only the selling vendor may perform this action');
    this.name = 'NotSellingVendorError';
  }
}

export class CheckoutService {
  constructor(private readonly deps: CheckoutDeps) {}

  /** Place an order against an available (vendor-owned) device. */
  async placeOrder(
    input: PlaceOrderInput & { listingId?: string },
    buyerUserId: string,
  ): Promise<{ order: Order; created: boolean }> {
    if (input.idempotencyKey) {
      const existing = await this.deps.orders.findByIdempotencyKey(buyerUserId, input.idempotencyKey);
      if (existing) return { order: existing, created: false };
    }

    const owner = await this.deps.inventory.getCurrentOwner(input.deviceId);
    if (!owner) throw new DeviceUnavailableError(input.deviceId, 'not found');
    if (owner.ownerType !== 'vendor') throw new DeviceUnavailableError(input.deviceId, 'not vendor-owned');
    if (owner.ownerId === buyerUserId) throw new DeviceUnavailableError(input.deviceId, 'buyer already owns it');

    const money = computeOrderMoney(input.subtotalHalalat);
    const now = this.deps.clock.now();
    const order = await this.deps.orders.create({
      orderId: randomUUID(),
      buyerUserId,
      vendorUserId: owner.ownerId,
      deviceId: input.deviceId,
      fulfillmentType: input.fulfillmentType,
      status: INITIAL_ORDER_STATE,
      subtotalHalalat: money.subtotalHalalat,
      commissionHalalat: money.commissionHalalat,
      vendorNetHalalat: money.vendorNetHalalat,
      totalHalalat: money.totalHalalat,
      listingId: input.listingId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdAt: now,
      updatedAt: now,
    });
    this.deps.logger.info(
      { event: 'ORDER_PLACED', orderId: order.orderId, buyerUserId, deviceId: input.deviceId, fulfillmentType: input.fulfillmentType },
      'order placed',
    );
    return { order, created: true };
  }

  /** Storefront placement: order against an active listing, snapshotting its price. */
  async placeOrderFromListing(
    input: { listingId: string; fulfillmentType: PlaceOrderInput['fulfillmentType']; idempotencyKey?: string },
    buyerUserId: string,
  ): Promise<{ order: Order; created: boolean }> {
    if (!this.deps.listings) throw new ListingUnavailableError(input.listingId);
    const listing = await this.deps.listings.getActiveListing(input.listingId);
    if (!listing) throw new ListingUnavailableError(input.listingId);
    return this.placeOrder(
      {
        deviceId: listing.deviceId,
        fulfillmentType: input.fulfillmentType,
        subtotalHalalat: listing.priceHalalat,
        listingId: input.listingId,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      },
      buyerUserId,
    );
  }

  /** Apply a payment provider result (idempotent by paymentRef). W5 drives this. */
  async applyPaymentResult(orderId: string, outcome: 'captured' | 'failed', paymentRef: string): Promise<Order> {
    const order = await this.requireOrder(orderId);
    if (order.paymentRef === paymentRef) return order; // idempotent replay

    if (outcome === 'failed') {
      return this.transition(order, ORDER_ACTIONS.PAY_FAILED, { paymentRef });
    }

    const updated = await this.transition(order, ORDER_ACTIONS.PAY_CAPTURED, { paymentRef });
    // Digital custody: hand the device to LAHTHA custody on payment, and the
    // order is complete → mark the listing sold.
    if (updated.status === ORDER_STATES.IN_CUSTODY) {
      await this.deps.inventory.transferOwnership(order.deviceId, {
        newOwnerId: LAHTHA_CUSTODY_OWNER,
        newOwnerType: 'lahtha_custody',
        acquisitionType: 'purchase',
        sourceEventId: order.orderId,
      });
      await this.markListingSold(order);
    }
    return updated;
  }

  /** Admin/ops ship (state override). */
  async ship(orderId: string, shippingRef: string): Promise<Order> {
    return this.performShip(await this.requireOrder(orderId), shippingRef);
  }

  /** Selling vendor ships their own order (AWAITING_FULFILLMENT → SHIPPED). */
  async shipByVendor(orderId: string, shippingRef: string, byVendorUserId: string): Promise<Order> {
    const order = await this.requireOrder(orderId);
    if (order.vendorUserId !== byVendorUserId) throw new NotSellingVendorError();
    return this.performShip(order, shippingRef);
  }

  private performShip(order: Order, shippingRef: string): Promise<Order> {
    return this.transition(order, ORDER_ACTIONS.SHIP, { shippingRef });
  }

  /** Admin/ops mark delivered (state override). */
  async deliver(orderId: string): Promise<Order> {
    return this.performDeliver(await this.requireOrder(orderId));
  }

  /** Buyer confirms receipt of their own order (SHIPPED → COMPLETED). */
  async confirmReceipt(orderId: string, byBuyerUserId: string): Promise<Order> {
    const order = await this.requireOrder(orderId);
    if (order.buyerUserId !== byBuyerUserId) throw new NotOrderOwnerError();
    return this.performDeliver(order);
  }

  /** Mark delivered → COMPLETED, transferring the device to the buyer. */
  private async performDeliver(order: Order): Promise<Order> {
    const updated = await this.transition(order, ORDER_ACTIONS.DELIVER, {});
    await this.deps.inventory.transferOwnership(order.deviceId, {
      newOwnerId: order.buyerUserId,
      newOwnerType: 'customer',
      acquisitionType: 'purchase',
      sourceEventId: order.orderId,
    });
    await this.markListingSold(order);
    return updated;
  }

  /** Best-effort: mark the source listing sold on completion (logged on failure). */
  private async markListingSold(order: Order): Promise<void> {
    if (!order.listingId || !this.deps.listingSold) return;
    try {
      await this.deps.listingSold.onOrderCompleted(order.listingId);
    } catch (err) {
      this.deps.logger.warn(
        { event: 'LISTING_MARK_SOLD_FAILED', orderId: order.orderId, listingId: order.listingId, err: String(err) },
        'order completed but listing could not be marked sold',
      );
    }
  }

  async cancel(orderId: string, byUserId: string): Promise<Order> {
    const order = await this.requireOrder(orderId);
    if (order.buyerUserId !== byUserId) throw new NotOrderOwnerError();
    return this.transition(order, ORDER_ACTIONS.CANCEL, {});
  }

  /** Admin refund — whole-order, reverses commission. (No ownership reversal in W4.) */
  async refund(orderId: string): Promise<Order> {
    const order = await this.requireOrder(orderId);
    const reversal = computeRefundReversal(order);
    const updated = await this.transition(order, ORDER_ACTIONS.REFUND, {
      refundedHalalat: order.totalHalalat,
    });
    this.deps.logger.info(
      { event: 'ORDER_REFUNDED', orderId, refundedHalalat: order.totalHalalat, commissionReversedHalalat: reversal },
      'order refunded',
    );
    return updated;
  }

  async getOrder(orderId: string): Promise<Order> {
    return this.requireOrder(orderId);
  }

  listByBuyer(buyerUserId: string): Promise<Order[]> {
    return this.deps.orders.listByBuyer(buyerUserId);
  }
  listByVendor(vendorUserId: string): Promise<Order[]> {
    return this.deps.orders.listByVendor(vendorUserId);
  }

  private async transition(order: Order, action: OrderAction, patch: OrderPatch): Promise<Order> {
    const nextState: OrderState = nextOrderState(order.status, action, order.fulfillmentType);
    const updated = await this.deps.orders.updateStatus(order.orderId, order.status, {
      status: nextState,
      ...patch,
    });
    if (!updated) throw new OrderConflictError(order.orderId);
    this.deps.logger.info(
      { event: 'ORDER_TRANSITION', orderId: order.orderId, action, from: order.status, to: nextState },
      'order transition',
    );
    return updated;
  }

  private async requireOrder(orderId: string): Promise<Order> {
    const order = await this.deps.orders.findById(orderId);
    if (!order) throw new OrderNotFoundError(orderId);
    return order;
  }
}
