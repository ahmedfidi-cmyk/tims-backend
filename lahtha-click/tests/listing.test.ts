import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeviceNotListableError,
  ListingConflictError,
  ListingNotFoundError,
  ListingService,
  NotListingOwnerError,
} from '../src/domains/lahtha/listing/listing.service.js';
import {
  InvalidListingTransition,
  nextListingStatus,
} from '../src/domains/lahtha/listing/listing-state.js';
import {
  FakeInventoryOwnership,
  InMemoryListingRepository,
  SystemClock,
} from '../src/domains/lahtha/listing/in-memory-adapters.js';

const silentLogger = { info: () => {}, warn: () => {} };

describe('listing state machine', () => {
  it('active → sold / withdrawn', () => {
    expect(nextListingStatus('active', 'SELL')).toBe('sold');
    expect(nextListingStatus('active', 'WITHDRAW')).toBe('withdrawn');
  });
  it('rejects illegal transitions', () => {
    expect(() => nextListingStatus('sold', 'SELL')).toThrow(InvalidListingTransition);
    expect(() => nextListingStatus('withdrawn', 'WITHDRAW')).toThrow(InvalidListingTransition);
  });
});

describe('ListingService', () => {
  let service: ListingService;
  let inv: FakeInventoryOwnership;

  beforeEach(() => {
    inv = new FakeInventoryOwnership();
    service = new ListingService({
      listings: new InMemoryListingRepository(),
      inventory: inv,
      clock: new SystemClock(),
      logger: silentLogger,
    });
    inv.setOwner('dev-1', { ownerId: 'vendor-1', ownerType: 'vendor' });
    inv.setSummary('dev-1', { modelName: 'iPhone 17 Pro', condition: 'new_sealed', imei: '350000000000000' });
  });

  it('browse returns active listings with a device summary', async () => {
    await service.createListing({ deviceId: 'dev-1', priceHalalat: 100_000 }, 'vendor-1');
    const page = await service.browse();
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.listing.priceHalalat).toBe(100_000);
    expect(page.items[0]?.device).toEqual({ modelName: 'iPhone 17 Pro', condition: 'new_sealed', imei: '350000000000000' });
  });

  it('browse filters by text, condition and price, and sorts', async () => {
    // dev-1 (iPhone 17 Pro / new_sealed / 100k) is seeded in beforeEach.
    inv.setOwner('dev-2', { ownerId: 'vendor-1', ownerType: 'vendor' });
    inv.setSummary('dev-2', { modelName: 'iPhone 16', condition: 'used', imei: '350000000000002' });
    inv.setOwner('dev-3', { ownerId: 'vendor-1', ownerType: 'vendor' });
    inv.setSummary('dev-3', { modelName: 'iPad Air', condition: 'refurbished', imei: '350000000000003' });
    await service.createListing({ deviceId: 'dev-1', priceHalalat: 100_000 }, 'vendor-1');
    await service.createListing({ deviceId: 'dev-2', priceHalalat: 300_000 }, 'vendor-1');
    await service.createListing({ deviceId: 'dev-3', priceHalalat: 50_000 }, 'vendor-1');

    expect((await service.browse()).total).toBe(3);

    const iphones = await service.browse({ q: 'iphone' });
    expect(iphones.total).toBe(2);

    const used = await service.browse({ condition: 'used' });
    expect(used.items.map((v) => v.listing.deviceId)).toEqual(['dev-2']);

    const cheap = await service.browse({ maxPriceHalalat: 100_000 });
    expect(cheap.total).toBe(2); // dev-1 + dev-3

    const pricey = await service.browse({ minPriceHalalat: 200_000 });
    expect(pricey.items.map((v) => v.listing.deviceId)).toEqual(['dev-2']);

    const asc = await service.browse({ sort: 'price_asc' });
    expect(asc.items[0]?.listing.priceHalalat).toBe(50_000);
    const desc = await service.browse({ sort: 'price_desc' });
    expect(desc.items[0]?.listing.priceHalalat).toBe(300_000);

    const paged = await service.browse({ limit: 1 });
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBe(3);
    expect(paged.limit).toBe(1);
  });

  it('a vendor lists an owned device', async () => {
    const l = await service.createListing({ deviceId: 'dev-1', priceHalalat: 100_000 }, 'vendor-1');
    expect(l.status).toBe('active');
    expect(l.priceHalalat).toBe(100_000);
    expect((await service.listActive()).map((x) => x.listingId)).toContain(l.listingId);
  });

  it('rejects listing a device not owned by the vendor', async () => {
    await expect(service.createListing({ deviceId: 'dev-1', priceHalalat: 1000 }, 'someone-else')).rejects.toBeInstanceOf(
      DeviceNotListableError,
    );
    await expect(service.createListing({ deviceId: 'ghost', priceHalalat: 1000 }, 'vendor-1')).rejects.toBeInstanceOf(
      DeviceNotListableError,
    );
  });

  it('rejects a non-positive price', async () => {
    await expect(service.createListing({ deviceId: 'dev-1', priceHalalat: 0 }, 'vendor-1')).rejects.toBeInstanceOf(
      DeviceNotListableError,
    );
  });

  it('allows only one active listing per device', async () => {
    await service.createListing({ deviceId: 'dev-1', priceHalalat: 100_000 }, 'vendor-1');
    await expect(service.createListing({ deviceId: 'dev-1', priceHalalat: 90_000 }, 'vendor-1')).rejects.toBeInstanceOf(
      ListingConflictError,
    );
  });

  it('withdraw is owner-only and frees the device to be relisted', async () => {
    const l = await service.createListing({ deviceId: 'dev-1', priceHalalat: 100_000 }, 'vendor-1');
    await expect(service.withdraw(l.listingId, 'intruder')).rejects.toBeInstanceOf(NotListingOwnerError);
    const w = await service.withdraw(l.listingId, 'vendor-1');
    expect(w.status).toBe('withdrawn');
    // device no longer has an active listing → can relist
    const l2 = await service.createListing({ deviceId: 'dev-1', priceHalalat: 95_000 }, 'vendor-1');
    expect(l2.status).toBe('active');
  });

  it('markSold moves active → sold', async () => {
    const l = await service.createListing({ deviceId: 'dev-1', priceHalalat: 100_000 }, 'vendor-1');
    const sold = await service.markSold(l.listingId);
    expect(sold.status).toBe('sold');
  });

  it('404s unknown listings', async () => {
    await expect(service.getById('nope')).rejects.toBeInstanceOf(ListingNotFoundError);
  });
});
