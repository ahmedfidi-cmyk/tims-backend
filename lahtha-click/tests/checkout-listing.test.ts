import { describe, it, expect, beforeEach } from 'vitest';
import { CheckoutService, ListingUnavailableError } from '../src/domains/lahtha/checkout/checkout.service.js';
import {
  FakeInventoryPort,
  InMemoryOrderRepository,
  SystemClock,
} from '../src/domains/lahtha/checkout/in-memory-adapters.js';
import { ListingService } from '../src/domains/lahtha/listing/listing.service.js';
import {
  FakeInventoryOwnership,
  InMemoryListingRepository,
  SystemClock as ListingClock,
} from '../src/domains/lahtha/listing/in-memory-adapters.js';
import { makeListingQueryPort, makeListingSoldPort } from '../src/domains/lahtha/listing/index.js';

const silentLogger = { info: () => {}, warn: () => {} };

function harness() {
  const listingInv = new FakeInventoryOwnership();
  listingInv.setOwner('dev-1', { ownerId: 'vendor-1', ownerType: 'vendor' });
  const listingService = new ListingService({
    listings: new InMemoryListingRepository(),
    inventory: listingInv,
    clock: new ListingClock(),
    logger: silentLogger,
  });

  const checkoutInv = new FakeInventoryPort();
  checkoutInv.setOwner('dev-1', { ownerId: 'vendor-1', ownerType: 'vendor' });
  const checkout = new CheckoutService({
    orders: new InMemoryOrderRepository(),
    inventory: checkoutInv,
    listings: makeListingQueryPort(listingService),
    listingSold: makeListingSoldPort(listingService),
    clock: new SystemClock(),
    logger: silentLogger,
  });

  return { listingService, checkout };
}

describe('checkout from listing', () => {
  let listingService: ListingService;
  let checkout: CheckoutService;
  beforeEach(() => {
    const h = harness();
    listingService = h.listingService;
    checkout = h.checkout;
  });

  it('places an order from a listing, snapshotting its price + listingId', async () => {
    const listing = await listingService.createListing({ deviceId: 'dev-1', priceHalalat: 250_000 }, 'vendor-1');
    const { order, created } = await checkout.placeOrderFromListing(
      { listingId: listing.listingId, fulfillmentType: 'digital_custody' },
      'buyer-1',
    );
    expect(created).toBe(true);
    expect(order.subtotalHalalat).toBe(250_000);
    expect(order.listingId).toBe(listing.listingId);
    expect(order.vendorUserId).toBe('vendor-1');
  });

  it('marks the listing sold when the order completes (digital custody)', async () => {
    const listing = await listingService.createListing({ deviceId: 'dev-1', priceHalalat: 250_000 }, 'vendor-1');
    const { order } = await checkout.placeOrderFromListing(
      { listingId: listing.listingId, fulfillmentType: 'digital_custody' },
      'buyer-1',
    );
    await checkout.applyPaymentResult(order.orderId, 'captured', 'pay-1');
    expect((await listingService.getById(listing.listingId)).status).toBe('sold');
  });

  it('rejects ordering a non-active listing', async () => {
    const listing = await listingService.createListing({ deviceId: 'dev-1', priceHalalat: 250_000 }, 'vendor-1');
    await listingService.withdraw(listing.listingId, 'vendor-1');
    await expect(
      checkout.placeOrderFromListing({ listingId: listing.listingId, fulfillmentType: 'digital_custody' }, 'buyer-1'),
    ).rejects.toBeInstanceOf(ListingUnavailableError);
  });
});
