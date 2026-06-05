// Mongoose RBAC adapters (production).

import mongoose, { Schema, type Model } from 'mongoose';
import { PRINCIPAL_TYPES, USER_STATUSES, type PrincipalType, type UserStatus } from './rbac-policy.js';
import type {
  AccessAuditEntry,
  AccessAuditRepository,
  Person,
  PersonRepository,
  RoleGrant,
  RoleGrantRepository,
  User,
  UserRepository,
} from './rbac-types.js';

const personSchema = new Schema<Person>(
  {
    personId: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    nationalIdHash: { type: String, default: null },
    primaryPhone: { type: String, required: true, unique: true },
    createdAt: { type: Date, required: true },
  },
  { collection: 'persons', versionKey: false },
);

const userSchema = new Schema<User>(
  {
    userId: { type: String, required: true, unique: true },
    personId: { type: String, required: true },
    principalType: { type: String, required: true, enum: PRINCIPAL_TYPES },
    status: { type: String, required: true, enum: USER_STATUSES },
    createdAt: { type: Date, required: true },
  },
  { collection: 'users', versionKey: false },
);
userSchema.index({ personId: 1, principalType: 1 }, { unique: true });

const grantSchema = new Schema<RoleGrant>(
  {
    userId: { type: String, required: true },
    roleId: { type: String, required: true },
    grantedAt: { type: Date, required: true },
    grantedBy: { type: String, required: true },
  },
  { collection: 'user_roles', versionKey: false },
);
grantSchema.index({ userId: 1, roleId: 1 }, { unique: true });

const auditSchema = new Schema<AccessAuditEntry>(
  {
    auditId: { type: String, required: true, unique: true },
    occurredAt: { type: Date, required: true },
    actorUserId: { type: String, required: true },
    actedOnUserId: { type: String, default: null },
    permissionId: { type: String, required: true },
    decision: { type: String, required: true, enum: ['allow', 'deny'] },
    resourceRef: { type: String, default: null },
    correlationId: { type: String, default: null },
    sourceIp: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { collection: 'access_audit', versionKey: false },
);

const PersonModel: Model<Person> =
  (mongoose.models.Person as Model<Person>) ?? mongoose.model<Person>('Person', personSchema);
const UserModel: Model<User> =
  (mongoose.models.User as Model<User>) ?? mongoose.model<User>('User', userSchema);
const GrantModel: Model<RoleGrant> =
  (mongoose.models.UserRole as Model<RoleGrant>) ?? mongoose.model<RoleGrant>('UserRole', grantSchema);
const AuditModel: Model<AccessAuditEntry> =
  (mongoose.models.AccessAudit as Model<AccessAuditEntry>) ??
  mongoose.model<AccessAuditEntry>('AccessAudit', auditSchema);

export class MongoPersonRepository implements PersonRepository {
  async create(person: Person): Promise<Person> {
    const doc = await PersonModel.create(person);
    return doc.toObject() as Person;
  }
  async findById(personId: string): Promise<Person | null> {
    return PersonModel.findOne({ personId }).lean<Person>().exec();
  }
  async findByPhone(primaryPhone: string): Promise<Person | null> {
    return PersonModel.findOne({ primaryPhone }).lean<Person>().exec();
  }
}

export class MongoUserRepository implements UserRepository {
  async create(user: User): Promise<User> {
    const doc = await UserModel.create(user);
    return doc.toObject() as User;
  }
  async findById(userId: string): Promise<User | null> {
    return UserModel.findOne({ userId }).lean<User>().exec();
  }
  async findByPersonAndType(personId: string, principalType: PrincipalType): Promise<User | null> {
    return UserModel.findOne({ personId, principalType }).lean<User>().exec();
  }
  async listByPerson(personId: string): Promise<User[]> {
    return UserModel.find({ personId }).lean<User[]>().exec();
  }
  async updateStatus(userId: string, status: UserStatus): Promise<void> {
    await UserModel.updateOne({ userId }, { $set: { status } }).exec();
  }
}

export class MongoRoleGrantRepository implements RoleGrantRepository {
  async grant(grant: RoleGrant): Promise<void> {
    // Idempotent upsert on (userId, roleId).
    await GrantModel.updateOne(
      { userId: grant.userId, roleId: grant.roleId },
      { $setOnInsert: grant },
      { upsert: true },
    ).exec();
  }
  async revoke(userId: string, roleId: string): Promise<boolean> {
    const res = await GrantModel.deleteOne({ userId, roleId }).exec();
    return res.deletedCount > 0;
  }
  async listForUser(userId: string): Promise<string[]> {
    const docs = await GrantModel.find({ userId }).lean<RoleGrant[]>().exec();
    return docs.map((d) => d.roleId);
  }
  async hasGrant(userId: string, roleId: string): Promise<boolean> {
    return (await GrantModel.countDocuments({ userId, roleId }).exec()) > 0;
  }
}

export class MongoAccessAuditRepository implements AccessAuditRepository {
  async append(entry: AccessAuditEntry): Promise<void> {
    await AuditModel.create(entry);
  }
  async list(filter: { actorUserId?: string; actedOnUserId?: string; limit?: number }): Promise<AccessAuditEntry[]> {
    const q: Record<string, unknown> = {};
    if (filter.actorUserId) q.actorUserId = filter.actorUserId;
    if (filter.actedOnUserId) q.actedOnUserId = filter.actedOnUserId;
    return AuditModel.find(q)
      .sort({ occurredAt: -1 })
      .limit(filter.limit ?? 100)
      .lean<AccessAuditEntry[]>()
      .exec();
  }
}
