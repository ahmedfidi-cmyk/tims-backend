// Inventory / IMEI migration (Workstream 3).
//
// Collections (docs/architecture/imei-inventory-schema.md, ADR-0003):
//   - devices           -> one row per physical unit; global IMEI uniqueness
//   - device_ownership  -> append-only history; exactly one current owner
//   - device_documents  -> proof artifacts (metadata; bytes on S3)

module.exports = {
  async up(db) {
    const ensure = async (name) => {
      const exists = await db.listCollections({ name }).hasNext();
      if (!exists) await db.createCollection(name);
      return db.collection(name);
    };

    const devices = await ensure('devices');
    await devices.createIndex({ deviceId: 1 }, { unique: true, name: 'deviceId_unique' });
    await devices.createIndex({ imei: 1 }, { unique: true, name: 'imei_unique' });
    // Sparse: dual-SIM imei2 is unique only when present.
    await devices.createIndex({ imei2: 1 }, { unique: true, sparse: true, name: 'imei2_unique' });
    await devices.createIndex({ serialNumber: 1 }, { unique: true, name: 'serial_unique' });

    const ownership = await ensure('device_ownership');
    await ownership.createIndex({ ownershipId: 1 }, { unique: true, name: 'ownershipId_unique' });
    // Exactly one current owner per device.
    await ownership.createIndex(
      { deviceId: 1 },
      { unique: true, partialFilterExpression: { releasedAt: null }, name: 'one_current_owner' },
    );
    await ownership.createIndex({ ownerId: 1, releasedAt: 1 }, { name: 'by_owner' });

    const documents = await ensure('device_documents');
    await documents.createIndex({ documentId: 1 }, { unique: true, name: 'documentId_unique' });
    await documents.createIndex({ s3Bucket: 1, s3Key: 1 }, { unique: true, name: 's3_object_unique' });
    await documents.createIndex({ deviceId: 1, documentType: 1 }, { name: 'by_device_type' });
  },

  async down(db) {
    await db.collection('device_documents').drop();
    await db.collection('device_ownership').drop();
    await db.collection('devices').drop();
  },
};
