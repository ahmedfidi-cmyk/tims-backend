// Vendor approval migration (Workstream 2 — IAM).
//
// Creates two collections backing the LAHTHA vendor lifecycle:
//   - vendors           -> vendor records + current lifecycle state
//   - vendor_audit_log  -> append-only audit trail (ARCHITECTURE.md §4: immutability)
//
// The audit collection is append-only at the application layer; no UPDATE or
// DELETE is performed against it (mirrors access_audit in iam-rbac.md).

module.exports = {
  async up(db) {
    const ensure = async (name) => {
      const exists = await db.listCollections({ name }).hasNext();
      if (!exists) await db.createCollection(name);
      return db.collection(name);
    };

    const vendors = await ensure('vendors');
    await vendors.createIndex({ vendorId: 1 }, { unique: true, name: 'vendorId_unique' });
    // Admin review queue: "oldest pending first".
    await vendors.createIndex({ status: 1, createdAt: 1 }, { name: 'by_status_created' });

    const audit = await ensure('vendor_audit_log');
    await audit.createIndex({ logId: 1 }, { unique: true, name: 'logId_unique' });
    // Full trail for one entity, chronological.
    await audit.createIndex({ entityId: 1, timestamp: 1 }, { name: 'by_entity_time' });
    await audit.createIndex({ correlationId: 1 }, { name: 'by_correlation', sparse: true });
  },

  async down(db) {
    await db.collection('vendor_audit_log').drop();
    await db.collection('vendors').drop();
  },
};
