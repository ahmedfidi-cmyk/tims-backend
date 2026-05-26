// Baseline migration: create the sync_events collection — the inter-domain
// event bus described in ARCHITECTURE.md §2 and docs/architecture/saga-compensation.md.
//
// Indexes:
//   - event_id (unique)               -> idempotent inserts
//   - (processed_at, occurred_at)     -> "oldest unprocessed first" consumer query
//   - saga_id (sparse)                -> trace all steps of a saga
//   - correlation_id                  -> trace a request across domains

module.exports = {
  async up(db) {
    const exists = await db.listCollections({ name: 'sync_events' }).hasNext();
    if (!exists) {
      await db.createCollection('sync_events');
    }
    const events = db.collection('sync_events');
    await events.createIndex({ event_id: 1 }, { unique: true, name: 'event_id_unique' });
    await events.createIndex(
      { processed_at: 1, occurred_at: 1 },
      { name: 'unprocessed_oldest_first' },
    );
    await events.createIndex({ saga_id: 1 }, { name: 'by_saga', sparse: true });
    await events.createIndex({ correlation_id: 1 }, { name: 'by_correlation' });
  },

  async down(db) {
    await db.collection('sync_events').drop();
  },
};
