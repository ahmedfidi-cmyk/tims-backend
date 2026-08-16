import { describe, it, expect } from 'vitest';
import { CheckoutService } from '../src/domains/lahtha/checkout/checkout.service.js';
import {
  FakeInventoryPort,
  FakeVendorCountPort,
  FixedClock,
  InMemoryOrderRepository,
  SystemClock,
} from '../src/domains/lahtha/checkout/in-memory-adapters.js';

const silentLogger = { info: () => {}, warn: () => {} };

function build(now = new Date('2026-03-15T00:00:00Z')) {
  const orders = new InMemoryOrderRepository();
  const inventory = new FakeInventoryPort();
  const vendorCount = new FakeVendorCountPort();
  const service = new CheckoutService({
    orders,
    inventory,
    vendorCount,
    clock: new FixedClock(now),
    logger: silentLogger,
  });
  return { service, orders, inventory, vendorCount };
}

async function place(
  service: CheckoutService,
  inventory: FakeInventoryPort,
  deviceId: string,
  buyerId: string,
  vendorId: string,
) {
  inventory.setOwner(deviceId, { ownerId: vendorId, ownerType: 'vendor' });
  const { order } = await service.placeOrder(
    { deviceId, fulfillmentType: 'digital_custody', subtotalHalalat: 100_000 },
    buyerId,
  );
  return order;
}

describe('CheckoutService.getAdminAnalytics', () => {
  it('counts only successful-terminal orders toward GMV/commission, but all orders toward totalOrders', async () => {
    const { service, inventory } = build();
    const paid = await place(service, inventory, 'dev-1', 'buyer-1', 'vendor-1');
    await service.applyPaymentResult(paid.orderId, 'captured', 'pay-1'); // -> IN_CUSTODY (successful)
    await place(service, inventory, 'dev-2', 'buyer-2', 'vendor-1'); // stays PENDING_PAYMENT

    const analytics = await service.getAdminAnalytics();
    expect(analytics.totalOrders).toBe(2);
    expect(analytics.successfulOrders).toBe(1);
    expect(analytics.totalGmvHalalat).toBe(100_000);
    expect(analytics.totalCommissionHalalat).toBe(5_000); // 5% commission on the one successful order
  });

  it('buckets same-month orders together', async () => {
    const { service, inventory } = build(new Date('2026-03-05T00:00:00Z'));
    const a = await place(service, inventory, 'dev-1', 'buyer-1', 'vendor-1');
    await service.applyPaymentResult(a.orderId, 'captured', 'pay-1');
    const b = await place(service, inventory, 'dev-2', 'buyer-2', 'vendor-1');
    await service.applyPaymentResult(b.orderId, 'captured', 'pay-2');

    const analytics = await service.getAdminAnalytics();
    expect(analytics.monthlyGrowth).toEqual([{ month: '2026-03', gmv: 200_000, orders: 2 }]);
  });

  it('groups monthly growth by UTC year-month, sorted ascending across months', async () => {
    // Two services share one order repo but run at different fixed times, so
    // each place()+pay() lands its order in a different real month.
    const orders = new InMemoryOrderRepository();
    const invJan = new FakeInventoryPort();
    const jan = new CheckoutService({
      orders, inventory: invJan, clock: new FixedClock(new Date('2026-01-10T00:00:00Z')), logger: silentLogger,
    });
    const invMar = new FakeInventoryPort();
    const mar = new CheckoutService({
      orders, inventory: invMar, clock: new FixedClock(new Date('2026-03-20T00:00:00Z')), logger: silentLogger,
    });

    const o1 = await place(jan, invJan, 'dev-1', 'buyer-1', 'vendor-1');
    await jan.applyPaymentResult(o1.orderId, 'captured', 'pay-1');
    const o2 = await place(mar, invMar, 'dev-2', 'buyer-2', 'vendor-1');
    await mar.applyPaymentResult(o2.orderId, 'captured', 'pay-2');

    const analytics = await jan.getAdminAnalytics();
    expect(analytics.monthlyGrowth).toEqual([
      { month: '2026-01', gmv: 100_000, orders: 1 },
      { month: '2026-03', gmv: 100_000, orders: 1 },
    ]);
  });

  it('reports zero active vendors when no vendorCount port is wired', async () => {
    const orders = new InMemoryOrderRepository();
    const service = new CheckoutService({
      orders,
      inventory: new FakeInventoryPort(),
      clock: new SystemClock(),
      logger: silentLogger,
    });
    const analytics = await service.getAdminAnalytics();
    expect(analytics.activeVendors).toBe(0);
    expect(analytics.totalOrders).toBe(0);
  });

  it('reflects the vendorCount port when wired', async () => {
    const { service, vendorCount } = build();
    vendorCount.setCount(7);
    const analytics = await service.getAdminAnalytics();
    expect(analytics.activeVendors).toBe(7);
  });
});
