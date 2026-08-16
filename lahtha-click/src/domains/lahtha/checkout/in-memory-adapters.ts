// In-memory checkout adapters for tests + reference impl.

import type {
  Clock,
  CurrentOwner,
  InventoryPort,
  NewOrder,
  Order,
  OrderPatch,
  OrderRepository,
  VendorCountPort,
} from './types.js';
import type { OrderState } from './order-state.js';
import type { AcquisitionType, OwnerType } from '../inventory/device-state.js';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly byId = new Map<string, Order>();

  async create(order: NewOrder): Promise<Order> {
    const record: Order = { ...order, paymentRef: null, shippingRef: null, refundedHalalat: null };
    this.byId.set(record.orderId, record);
    return { ...record };
  }
  async findById(orderId: string): Promise<Order | null> {
    const o = this.byId.get(orderId);
    return o ? { ...o } : null;
  }
  async findByIdempotencyKey(buyerUserId: string, key: string): Promise<Order | null> {
    for (const o of this.byId.values()) {
      if (o.buyerUserId === buyerUserId && o.idempotencyKey === key) return { ...o };
    }
    return null;
  }
  async listByBuyer(buyerUserId: string): Promise<Order[]> {
    return [...this.byId.values()].filter((o) => o.buyerUserId === buyerUserId).map((o) => ({ ...o }));
  }
  async listByVendor(vendorUserId: string): Promise<Order[]> {
    return [...this.byId.values()].filter((o) => o.vendorUserId === vendorUserId).map((o) => ({ ...o }));
  }
  async listAll(): Promise<Order[]> {
    return [...this.byId.values()].map((o) => ({ ...o }));
  }
  async updateStatus(orderId: string, expectedFrom: OrderState, patch: OrderPatch): Promise<Order | null> {
    const o = this.byId.get(orderId);
    if (!o || o.status !== expectedFrom) return null; // compare-and-set guard
    const updated: Order = { ...o, ...patch, updatedAt: new Date() };
    this.byId.set(orderId, updated);
    return { ...updated };
  }
}

/** Configurable in-memory inventory for tests: device -> current owner, records transfers. */
export class FakeInventoryPort implements InventoryPort {
  private readonly owners = new Map<string, CurrentOwner>();
  readonly transfers: Array<{ deviceId: string; newOwnerId: string; newOwnerType: OwnerType; acquisitionType: AcquisitionType }> = [];

  setOwner(deviceId: string, owner: CurrentOwner): void {
    this.owners.set(deviceId, owner);
  }
  async getCurrentOwner(deviceId: string): Promise<CurrentOwner | null> {
    return this.owners.get(deviceId) ?? null;
  }
  async transferOwnership(
    deviceId: string,
    args: { newOwnerId: string; newOwnerType: OwnerType; acquisitionType: AcquisitionType; sourceEventId?: string },
  ): Promise<void> {
    this.owners.set(deviceId, { ownerId: args.newOwnerId, ownerType: args.newOwnerType });
    this.transfers.push({ deviceId, newOwnerId: args.newOwnerId, newOwnerType: args.newOwnerType, acquisitionType: args.acquisitionType });
  }
}

/** Configurable in-memory vendor count for tests. */
export class FakeVendorCountPort implements VendorCountPort {
  constructor(private count = 0) {}
  setCount(n: number): void {
    this.count = n;
  }
  async countActiveVendors(): Promise<number> {
    return this.count;
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
