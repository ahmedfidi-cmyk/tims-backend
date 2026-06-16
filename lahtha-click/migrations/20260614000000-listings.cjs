// Listings migration (ADR-0006) — priced vendor offers for the storefront.

module.exports = {
  async up(db) {
    const exists = await db.listCollections({ name: 'listings' }).hasNext();
    if (!exists) await db.createCollection('listings');
    const listings = db.collection('listings');

    await listings.createIndex({ listingId: 1 }, { unique: true, name: 'listingId_unique' });
    // At most one active listing per device.
    await listings.createIndex(
      { deviceId: 1 },
      { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_active_per_device' },
    );
    await listings.createIndex({ vendorUserId: 1, createdAt: -1 }, { name: 'by_vendor' });
    await listings.createIndex({ status: 1, createdAt: -1 }, { name: 'by_status' });
  },

  async down(db) {
    await db.collection('listings').drop();
  },
};
