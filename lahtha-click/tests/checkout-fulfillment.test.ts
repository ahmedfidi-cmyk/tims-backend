import { describe, it, expect, beforeEach } from 'vitest';
import {
  CheckoutService,
  NotOrderOwnerError,
  NotSellingVendorError,
} from '../src/domains/lahtha/checkout/checkout.service.js';
import { InvalidOrderTransition } from '../src/domains/lahtha/checkout/order-state.js';
import {
  FakeInventoryPort,
  InMemoryOrderRepository,
  SystemClock,
} from '../src/domains/lahtha/checkout/in-memory-adapters.js';
import type { Order } from '../src/domains/lahtha/checkout/types.js';

const silentLogger = { info: () => {}, warn: () => {} };

function harness() {
  const inv = new FakeInventoryPort();
  inv.setOwner('dev-1', { ownerId: 'vendor-1', ownerType: 'vendor' });
  const checkout = new CheckoutService({
    orders: new InMemoryOrderRepository(),
    inventory: inv,
    clock: new SystemClock(),
    logger: silentLogger,
  });
  return { checkout, inv };
}

/** A paid physical order, sitting in AWAITING_FULFILLMENT. */
async function awaitingOrder(checkout: CheckoutService): Promise<Order> {
  const { order } = await checkout.placeOrder(
    { deviceId: 'dev-1', fulfillmentType: 'physical_fulfillment', subtotalHalalat: 100_000 },
    'buyer-1',
  );
  await checkout.applyPaymentResult(order.orderId, 'captured', 'pay-1');
  return order;
}

describe('CheckoutService — vendor fulfillment', () => {
  let checkout: CheckoutService;
  let inv: FakeInventoryPort;
  beforeEach(() => {
    const h = harness();
    checkout = h.checkout;
    inv = h.inv;
  });

  it('lets the selling vendor ship their own paid order', async () => {
    const order = await awaitingOrder(checkout);
    expect((await checkout.getOrder(order.orderId)).status).toBe('AWAITING_FULFILLMENT');
    const shipped = await checkout.shipByVendor(order.orderId, 'TRACK-123', 'vendor-1');
    expect(shipped.status).toBe('SHIPPED');
    expect(shipped.shippingRef).toBe('TRACK-123');
  });

  it('refuses to let a different vendor ship the order', async () => {
    const order = await awaitingOrder(checkout);
    await expect(checkout.shipByVendor(order.orderId, 'TRACK-123', 'vendor-2')).rejects.toBeInstanceOf(
      NotSellingVendorError,
    );
  });

  it('cannot ship before payment is captured', async () => {
    const { order } = await checkout.placeOrder(
      { deviceId: 'dev-1', fulfillmentType: 'physical_fulfillment', subtotalHalalat: 100_000 },
      'buyer-1',
    );
    await expect(checkout.shipByVendor(order.orderId, 'TRACK-123', 'vendor-1')).rejects.toBeInstanceOf(
      InvalidOrderTransition,
    );
  });

  it('lets the buyer confirm receipt → COMPLETED and transfers the device', async () => {
    const order = await awaitingOrder(checkout);
    await checkout.shipByVendor(order.orderId, 'TRACK-123', 'vendor-1');
    const completed = await checkout.confirmReceipt(order.orderId, 'buyer-1');
    expect(completed.status).toBe('COMPLETED');
    const owner = await inv.getCurrentOwner('dev-1');
    expect(owner).toEqual({ ownerId: 'buyer-1', ownerType: 'customer' });
  });

  it('refuses to let a different buyer confirm receipt', async () => {
    const order = await awaitingOrder(checkout);
    await checkout.shipByVendor(order.orderId, 'TRACK-123', 'vendor-1');
    await expect(checkout.confirmReceipt(order.orderId, 'someone-else')).rejects.toBeInstanceOf(NotOrderOwnerError);
  });

  it('cannot confirm receipt before the order ships', async () => {
    const order = await awaitingOrder(checkout);
    await expect(checkout.confirmReceipt(order.orderId, 'buyer-1')).rejects.toBeInstanceOf(InvalidOrderTransition);
  });
});
