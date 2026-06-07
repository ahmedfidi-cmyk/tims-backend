// Checkout migration (Workstream 4, ADR-0004).
//
// Adds the `orders` collection. The order carries the commercial terms (price +
// commission); the devices collection is unchanged.

module.exports = {
  async up(db) {
    const exists = await db.listCollections({ name: 'orders' }).hasNext();
    if (!exists) await db.createCollection('orders');
    const orders = db.collection('orders');

    await orders.createIndex({ orderId: 1 }, { unique: true, name: 'orderId_unique' });
    // Idempotent placement per buyer (only when a key is supplied).
    await orders.createIndex(
      { buyerUserId: 1, idempotencyKey: 1 },
      { unique: true, sparse: true, name: 'buyer_idempotency_unique' },
    );
    await orders.createIndex({ buyerUserId: 1, createdAt: -1 }, { name: 'by_buyer' });
    await orders.createIndex({ vendorUserId: 1, createdAt: -1 }, { name: 'by_vendor' });
    await orders.createIndex({ deviceId: 1 }, { name: 'by_device' });
  },

  async down(db) {
    await db.collection('orders').drop();
  },
};
