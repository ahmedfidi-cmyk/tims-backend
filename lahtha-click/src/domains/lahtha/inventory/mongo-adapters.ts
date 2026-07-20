// Mongoose inventory adapters (production).

import mongoose, { Schema, type Model } from 'mongoose';
import { DEVICE_CONDITIONS, DOCUMENT_TYPES, type Device, type DeviceDocument, type DeviceDocumentRepository, type DeviceOwnership, type DeviceOwnershipRepository, type DeviceRepository } from './types.js';
import { ACQUISITION_TYPES, OWNER_TYPES } from './device-state.js';

const deviceSchema = new Schema<Device>(
  {
    deviceId: { type: String, required: true, unique: true },
    imei: { type: String, required: true, unique: true },
    imei2: { type: String, default: null },
    serialNumber: { type: String, required: true, unique: true },
    modelCode: { type: String, required: true },
    modelName: { type: String, required: true },
    storageGb: { type: Number, default: null },
    color: { type: String, default: null },
    condition: { type: String, required: true, enum: DEVICE_CONDITIONS },
    registeredBy: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { collection: 'devices', versionKey: false },
);
// Sparse unique: only enforced when imei2 is present.
deviceSchema.index({ imei2: 1 }, { unique: true, sparse: true });

const ownershipSchema = new Schema<DeviceOwnership>(
  {
    ownershipId: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    ownerId: { type: String, required: true },
    ownerType: { type: String, required: true, enum: OWNER_TYPES },
    acquiredAt: { type: Date, required: true },
    acquisitionType: { type: String, required: true, enum: ACQUISITION_TYPES },
    sourceEventId: { type: String, default: null },
    releasedAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
  },
  { collection: 'device_ownership', versionKey: false },
);
// Exactly one current owner per device.
ownershipSchema.index(
  { deviceId: 1 },
  { unique: true, partialFilterExpression: { releasedAt: null } },
);
ownershipSchema.index({ ownerId: 1, releasedAt: 1 });

const documentSchema = new Schema<DeviceDocument>(
  {
    documentId: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    documentType: { type: String, required: true, enum: DOCUMENT_TYPES },
    s3Bucket: { type: String, required: true },
    s3Key: { type: String, required: true },
    sha256: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedBy: { type: String, required: true },
    uploadedAt: { type: Date, required: true },
  },
  { collection: 'device_documents', versionKey: false },
);
documentSchema.index({ s3Bucket: 1, s3Key: 1 }, { unique: true });
documentSchema.index({ deviceId: 1, documentType: 1 });

const DeviceModel: Model<Device> =
  (mongoose.models.Device as Model<Device>) ?? mongoose.model<Device>('Device', deviceSchema);
const OwnershipModel: Model<DeviceOwnership> =
  (mongoose.models.DeviceOwnership as Model<DeviceOwnership>) ??
  mongoose.model<DeviceOwnership>('DeviceOwnership', ownershipSchema);
const DocumentModel: Model<DeviceDocument> =
  (mongoose.models.DeviceDocument as Model<DeviceDocument>) ??
  mongoose.model<DeviceDocument>('DeviceDocument', documentSchema);

export class MongoDeviceRepository implements DeviceRepository {
  async create(device: Device): Promise<Device> {
    const doc = await DeviceModel.create(device);
    return doc.toObject() as Device;
  }
  async findById(deviceId: string): Promise<Device | null> {
    return DeviceModel.findOne({ deviceId }).lean<Device>().exec();
  }
  async findByImei(imei: string): Promise<Device | null> {
    return DeviceModel.findOne({ $or: [{ imei }, { imei2: imei }] }).lean<Device>().exec();
  }
  async findBySerial(serialNumber: string): Promise<Device | null> {
    return DeviceModel.findOne({ serialNumber }).lean<Device>().exec();
  }
  async listAll(limit: number, offset: number): Promise<{ items: Device[]; total: number }> {
    const [items, total] = await Promise.all([
      DeviceModel.find().sort({ createdAt: -1 }).skip(offset).limit(limit).lean<Device[]>().exec(),
      DeviceModel.countDocuments().exec(),
    ]);
    return { items, total };
  }
  async deleteById(deviceId: string): Promise<void> {
    await DeviceModel.deleteOne({ deviceId }).exec();
  }
}

export class MongoDeviceOwnershipRepository implements DeviceOwnershipRepository {
  async create(ownership: DeviceOwnership): Promise<DeviceOwnership> {
    const doc = await OwnershipModel.create(ownership);
    return doc.toObject() as DeviceOwnership;
  }
  async findCurrent(deviceId: string): Promise<DeviceOwnership | null> {
    return OwnershipModel.findOne({ deviceId, releasedAt: null }).lean<DeviceOwnership>().exec();
  }
  async releaseCurrent(deviceId: string, when: Date): Promise<DeviceOwnership | null> {
    return OwnershipModel.findOneAndUpdate(
      { deviceId, releasedAt: null },
      { $set: { releasedAt: when } },
      { new: false },
    )
      .lean<DeviceOwnership>()
      .exec();
  }
  async listDeviceIdsByCurrentOwner(ownerId: string): Promise<string[]> {
    const rows = await OwnershipModel.find({ ownerId, releasedAt: null })
      .select('deviceId')
      .lean<Array<{ deviceId: string }>>()
      .exec();
    return rows.map((r) => r.deviceId);
  }
  async deleteByDevice(deviceId: string): Promise<void> {
    await OwnershipModel.deleteMany({ deviceId }).exec();
  }
}

export class MongoDeviceDocumentRepository implements DeviceDocumentRepository {
  async create(doc: DeviceDocument): Promise<DeviceDocument> {
    const created = await DocumentModel.create(doc);
    return created.toObject() as DeviceDocument;
  }
  async listByDevice(deviceId: string): Promise<DeviceDocument[]> {
    return DocumentModel.find({ deviceId }).sort({ uploadedAt: 1 }).lean<DeviceDocument[]>().exec();
  }
}
