// IAM RBAC migration (Workstream 2 — IAM).
//
// Collections (docs/architecture/iam-rbac.md):
//   - persons      -> one human; UNIQUE primary_phone
//   - users        -> principals; UNIQUE (personId, principalType) multi-principal linkage
//   - user_roles   -> role grants; UNIQUE (userId, roleId)
//   - access_audit -> append-only authorization decision log
//
// roles / permissions / role_permissions are an in-code catalog (rbac-policy.ts),
// so they are not persisted here.

module.exports = {
  async up(db) {
    const ensure = async (name) => {
      const exists = await db.listCollections({ name }).hasNext();
      if (!exists) await db.createCollection(name);
      return db.collection(name);
    };

    const persons = await ensure('persons');
    await persons.createIndex({ personId: 1 }, { unique: true, name: 'personId_unique' });
    await persons.createIndex({ primaryPhone: 1 }, { unique: true, name: 'primaryPhone_unique' });

    const users = await ensure('users');
    await users.createIndex({ userId: 1 }, { unique: true, name: 'userId_unique' });
    await users.createIndex(
      { personId: 1, principalType: 1 },
      { unique: true, name: 'person_principal_unique' },
    );

    const grants = await ensure('user_roles');
    await grants.createIndex({ userId: 1, roleId: 1 }, { unique: true, name: 'user_role_unique' });

    const audit = await ensure('access_audit');
    await audit.createIndex({ auditId: 1 }, { unique: true, name: 'auditId_unique' });
    await audit.createIndex({ actorUserId: 1, occurredAt: -1 }, { name: 'by_actor_time' });
    await audit.createIndex({ occurredAt: -1 }, { name: 'recent' });
  },

  async down(db) {
    await db.collection('access_audit').drop();
    await db.collection('user_roles').drop();
    await db.collection('users').drop();
    await db.collection('persons').drop();
  },
};
