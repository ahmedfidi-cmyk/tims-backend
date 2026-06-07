import { describe, it, expect, beforeEach } from 'vitest';
import {
  CheckoutService,
  DeviceUnavailableError,
  LAHTHA_CUSTODY_OWNER,
  NotOrderOwnerError,
  OrderNotFoundError,
} from '../src/domains/lahtha/checkout/checkout.service.js';
import { InvalidOrderTransition } from '../src/domains/lahtha/checkout/order-state.js';
import {
  FakeInventoryPort,
  FixedClock,
  InMemoryOrderRepository,
} from '../src/domains/lahtha/checkout/in-memory-adapters.js';

const silentLogger = { info: () => {}, warn: () => {} };

function build() {
  const inventory = new FakeInventoryPort();
  const service = new CheckoutService({
    orders: new InMemoryOrderRepository(),
    inventory,
    clock: new FixedClock(new Date('2026-06-07T00:00:00Z')),
    logger: silentLogger,
  });
  return { service, inventory };
}

function vendorDevice(inv: FakeInventoryPort, deviceId = 'dev-1', vendorId = 'vendor-1') {
  inv.setOwner(deviceId, { ownerId: vendorId, ownerType: 'vendor' });
  return { deviceId, vendorId };
}

const place = (deviceId: string, fulfillmentType: 'physical_fulfillment' | 'digital_custody') => ({
  deviceId,
  fulfillmentType,
  subtotalHalalat: 100_000,
});

describe('CheckoutService', () => {
  let service: CheckoutService;
  let inventory: FakeInventoryPort;
  beforeEach(() => {
    const b = build();
    service = b.service;
    inventory = b.inventory;
  });

  it('places an order against a vendor-owned device with computed money', async () => {
    const { deviceId, vendorId } = vendorDevice(inventory);
    const { order, created } = await service.placeOrder(place(deviceId, 'physical_fulfillment'), 'buyer-1');
    expect(created).toBe(true);
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.vendorUserId).toBe(vendorId);
    expect(order.commissionHalalat).toBe(5_000);
    expect(order.vendorNetHalalat).toBe(95_000);
  });

  it('rejects ordering an unavailable / non-vendor / self-owned device', async () => {
    await expect(service.placeOrder(place('ghost', 'digital_custody'), 'b')).rejects.toBeInstanceOf(
      DeviceUnavailableError,
    );
    inventory.setOwner('cust-dev', { ownerId: 'someone', ownerType: 'customer' });
    await expect(service.placeOrder(place('cust-dev', 'digital_custody'), 'b')).rejects.toBeInstanceOf(
      DeviceUnavailableError,
    );
    vendorDevice(inventory, 'mine', 'buyer-x');
    await expect(service.placeOrder(place('mine', 'digital_custody'), 'buyer-x')).rejects.toBeInstanceOf(
      DeviceUnavailableError,
    );
  });

  it('is idempotent on the placement key', async () => {
    const { deviceId } = vendorDevice(inventory);
    const first = await service.placeOrder({ ...place(deviceId, 'digital_custody'), idempotencyKey: 'k1' }, 'buyer-1');
    const second = await service.placeOrder({ ...place(deviceId, 'digital_custody'), idempotencyKey: 'k1' }, 'buyer-1');
    expect(second.created).toBe(false);
    expect(second.order.orderId).toBe(first.order.orderId);
  });

  describe('digital custody', () => {
    it('payment moves to IN_CUSTODY and transfers the device to LAHTHA custody', async () => {
      const { deviceId } = vendorDevice(inventory);
      const { order } = await service.placeOrder(place(deviceId, 'digital_custody'), 'buyer-1');
      const paid = await service.applyPaymentResult(order.orderId, 'captured', 'pay-1');
      expect(paid.status).toBe('IN_CUSTODY');
      expect(paid.paymentRef).toBe('pay-1');
      const owner = await inventory.getCurrentOwner(deviceId);
      expect(owner).toEqual({ ownerId: LAHTHA_CUSTODY_OWNER, ownerType: 'lahtha_custody' });
    });
  });

  describe('physical fulfillment', () => {
    it('pays → ships → delivers → COMPLETED and transfers to the buyer', async () => {
      const { deviceId } = vendorDevice(inventory);
      const { order } = await service.placeOrder(place(deviceId, 'physical_fulfillment'), 'buyer-1');
      expect((await service.applyPaymentResult(order.orderId, 'captured', 'pay-1')).status).toBe('AWAITING_FULFILLMENT');
      expect((await service.ship(order.orderId, 'TRK-1')).status).toBe('SHIPPED');
      const done = await service.deliver(order.orderId);
      expect(done.status).toBe('COMPLETED');
      expect(await inventory.getCurrentOwner(deviceId)).toEqual({ ownerId: 'buyer-1', ownerType: 'customer' });
    });
  });

  it('records a failed payment without transferring ownership', async () => {
    const { deviceId } = vendorDevice(inventory);
    const { order } = await service.placeOrder(place(deviceId, 'digital_custody'), 'buyer-1');
    const failed = await service.applyPaymentResult(order.orderId, 'failed', 'pay-x');
    expect(failed.status).toBe('PAYMENT_FAILED');
    expect(await inventory.getCurrentOwner(deviceId)).toEqual({ ownerId: 'vendor-1', ownerType: 'vendor' });
  });

  it('payment is idempotent on the same paymentRef', async () => {
    const { deviceId } = vendorDevice(inventory);
    const { order } = await service.placeOrder(place(deviceId, 'digital_custody'), 'buyer-1');
    await service.applyPaymentResult(order.orderId, 'captured', 'pay-1');
    const replay = await service.applyPaymentResult(order.orderId, 'captured', 'pay-1');
    expect(replay.status).toBe('IN_CUSTODY');
    expect(inventory.transfers.filter((t) => t.deviceId === deviceId)).toHaveLength(1);
  });

  it('only the buyer can cancel, and only while pending', async () => {
    const { deviceId } = vendorDevice(inventory);
    const { order } = await service.placeOrder(place(deviceId, 'digital_custody'), 'buyer-1');
    await expect(service.cancel(order.orderId, 'someone-else')).rejects.toBeInstanceOf(NotOrderOwnerError);
    const cancelled = await service.cancel(order.orderId, 'buyer-1');
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('rejects an illegal transition (cancel after payment)', async () => {
    const { deviceId } = vendorDevice(inventory);
    const { order } = await service.placeOrder(place(deviceId, 'digital_custody'), 'buyer-1');
    await service.applyPaymentResult(order.orderId, 'captured', 'pay-1');
    await expect(service.cancel(order.orderId, 'buyer-1')).rejects.toBeInstanceOf(InvalidOrderTransition);
  });

  it('refunds a completed order and records the amount', async () => {
    const { deviceId } = vendorDevice(inventory);
    const { order } = await service.placeOrder(place(deviceId, 'digital_custody'), 'buyer-1');
    await service.applyPaymentResult(order.orderId, 'captured', 'pay-1');
    const refunded = await service.refund(order.orderId);
    expect(refunded.status).toBe('REFUNDED');
    expect(refunded.refundedHalalat).toBe(100_000);
  });

  it('404s unknown orders', async () => {
    await expect(service.getOrder('nope')).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
