// Mongoose-backed implementations of the vendor + audit ports.
//
// Model registration is lazy and does not require a live connection, so this
// module is safe to import during app construction (and in tests).

import mongoose, { Schema, type Model } from 'mongoose';
import type {
  AuditEntry,
  AuditRepository,
  NewVendor,
  Vendor,
  VendorRepository,
} from './types.js';
import { VENDOR_STATES, type VendorState } from './vendor-approval.js';

interface VendorDoc {
  vendorId: string;
  name: string;
  contactEmail: string;
  status: VendorState;
  ownershipProofRef: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<VendorDoc>(
  {
    vendorId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    contactEmail: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(VENDOR_STATES),
    },
    ownershipProofRef: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: 'vendors', versionKey: false },
);

interface AuditDoc {
  logId: string;
  entityId: string;
  entityType: string;
  action: string;
  previousState: string;
  newState: string;
  actor: string;
  metadata: Record<string, unknown>;
  correlationId: string | null;
  timestamp: Date;
}

const auditSchema = new Schema<AuditDoc>(
  {
    logId: { type: String, required: true, unique: true },
    entityId: { type: String, required: true },
    entityType: { type: String, required: true },
    action: { type: String, required: true },
    previousState: { type: String, required: true },
    newState: { type: String, required: true },
    actor: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    correlationId: { type: String, default: null },
    timestamp: { type: Date, required: true },
  },
  { collection: 'vendor_audit_log', versionKey: false },
);

// Reuse the model if already registered (hot reload / repeated imports).
const VendorModel: Model<VendorDoc> =
  (mongoose.models.Vendor as Model<VendorDoc>) ?? mongoose.model<VendorDoc>('Vendor', vendorSchema);
const AuditModel: Model<AuditDoc> =
  (mongoose.models.VendorAudit as Model<AuditDoc>) ??
  mongoose.model<AuditDoc>('VendorAudit', auditSchema);

function toVendor(doc: VendorDoc): Vendor {
  return {
    vendorId: doc.vendorId,
    name: doc.name,
    contactEmail: doc.contactEmail,
    status: doc.status,
    ownershipProofRef: doc.ownershipProofRef,
    rejectionReason: doc.rejectionReason,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoVendorRepository implements VendorRepository {
  async create(vendor: NewVendor): Promise<Vendor> {
    const doc = await VendorModel.create({
      ...vendor,
      ownershipProofRef: null,
      rejectionReason: null,
    });
    return toVendor(doc.toObject());
  }

  async findById(vendorId: string): Promise<Vendor | null> {
    const doc = await VendorModel.findOne({ vendorId }).lean<VendorDoc>().exec();
    return doc ? toVendor(doc) : null;
  }

  async updateState(
    vendorId: string,
    expectedFrom: VendorState,
    patch: Partial<Pick<Vendor, 'status' | 'ownershipProofRef' | 'rejectionReason'>>,
  ): Promise<Vendor | null> {
    // Atomic compare-and-set: the {status: expectedFrom} filter makes the
    // update a no-op (returns null) if another writer already moved the state.
    const doc = await VendorModel.findOneAndUpdate(
      { vendorId, status: expectedFrom },
      { $set: { ...patch, updatedAt: new Date() } },
      { new: true },
    )
      .lean<VendorDoc>()
      .exec();
    return doc ? toVendor(doc) : null;
  }

  async listByStatus(status: VendorState, limit = 100): Promise<Vendor[]> {
    const docs = await VendorModel.find({ status })
      .sort({ createdAt: 1 }) // uses the by_status_created index
      .limit(limit)
      .lean<VendorDoc[]>()
      .exec();
    return docs.map(toVendor);
  }
}

export class MongoAuditRepository implements AuditRepository {
  async append(entry: AuditEntry): Promise<void> {
    await AuditModel.create(entry);
  }

  async listForEntity(entityId: string): Promise<AuditEntry[]> {
    const docs = await AuditModel.find({ entityId })
      .sort({ timestamp: 1 })
      .lean<AuditDoc[]>()
      .exec();
    return docs.map((d) => ({
      logId: d.logId,
      entityId: d.entityId,
      entityType: d.entityType,
      action: d.action as AuditEntry['action'],
      previousState: d.previousState,
      newState: d.newState,
      actor: d.actor,
      metadata: d.metadata ?? {},
      correlationId: d.correlationId,
      timestamp: d.timestamp,
    }));
  }
}
