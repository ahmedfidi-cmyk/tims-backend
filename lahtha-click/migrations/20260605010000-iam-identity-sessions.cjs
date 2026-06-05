// IAM identity + sessions migration (Workstream 2 — IAM).
//
// Collections:
//   - vendor_identities -> vendor profile (business name, email, phone)
//   - otp_challenges     -> one-time-password challenges (auto-expire via TTL)
//   - sessions           -> opaque session tokens (hashed) + scopes
//
// OTP challenges and sessions carry MongoDB TTL indexes so expired rows are
// reaped automatically (defence-in-depth on top of the app-layer expiry checks).

module.exports = {
  async up(db) {
    const ensure = async (name) => {
      const exists = await db.listCollections({ name }).hasNext();
      if (!exists) await db.createCollection(name);
      return db.collection(name);
    };

    const identities = await ensure('vendor_identities');
    await identities.createIndex({ vendorId: 1 }, { unique: true, name: 'vendorId_unique' });
    await identities.createIndex({ email: 1 }, { unique: true, name: 'email_unique' });

    const otps = await ensure('otp_challenges');
    await otps.createIndex({ challengeId: 1 }, { unique: true, name: 'challengeId_unique' });
    await otps.createIndex({ vendorId: 1, createdAt: -1 }, { name: 'by_vendor_recent' });
    // TTL: drop a challenge shortly after it expires.
    await otps.createIndex({ expiresAt: 1 }, { name: 'ttl_expiresAt', expireAfterSeconds: 0 });

    const sessions = await ensure('sessions');
    await sessions.createIndex({ sessionId: 1 }, { unique: true, name: 'sessionId_unique' });
    await sessions.createIndex({ tokenHash: 1 }, { unique: true, name: 'tokenHash_unique' });
    await sessions.createIndex({ vendorId: 1 }, { name: 'by_vendor' });
    // TTL: drop a session at its absolute expiry.
    await sessions.createIndex(
      { absoluteExpiresAt: 1 },
      { name: 'ttl_absoluteExpiresAt', expireAfterSeconds: 0 },
    );
  },

  async down(db) {
    await db.collection('sessions').drop();
    await db.collection('otp_challenges').drop();
    await db.collection('vendor_identities').drop();
  },
};
