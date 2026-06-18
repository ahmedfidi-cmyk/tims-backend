// Payments migration (ADR-0007).

module.exports = {
  async up(db) {
    const exists = await db.listCollections({ name: 'payments' }).hasNext();
    if (!exists) await db.createCollection('payments');
    const payments = db.collection('payments');
    await payments.createIndex({ paymentId: 1 }, { unique: true, name: 'paymentId_unique' });
    await payments.createIndex({ intentId: 1 }, { unique: true, name: 'intentId_unique' });
    await payments.createIndex({ orderId: 1 }, { name: 'by_order' });
  },
  async down(db) {
    await db.collection('payments').drop();
  },
};
