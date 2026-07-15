// Inventory service — registration, documents, ownership over ports. No HTTP or
// Mongoose knowledge; authorization is applied at the router (IAM authz).

import { randomUUID } from 'node:crypto';
import { isValidImei, normalizeImei } from './imei.js';
import { isKnownModel, modelNameFor } from './model-catalog.js';
import { deriveDeviceState, type AcquisitionType, type DeviceState, type OwnerType } from './device-state.js';
import type {
  AuditLogger,
  Clock,
  Device,
  DeviceDocument,
  DeviceDocumentRepository,
  DeviceOwnership,
  DeviceOwnershipRepository,
  DeviceRepository,
  DocumentType,
  ObjectStoragePort,
  PresignedUpload,
} from './types.js';
import type { AddDocumentInput, RegisterDeviceInput } from './schemas.js';

export interface InventoryDeps {
  devices: DeviceRepository;
  ownership: DeviceOwnershipRepository;
  documents: DeviceDocumentRepository;
  storage: ObjectStoragePort;
  clock: Clock;
  logger: AuditLogger;
}

// --- Errors ---
export class InvalidImeiError extends Error {
  constructor() {
    super('IMEI is not a valid 15-digit Luhn number');
    this.name = 'InvalidImeiError';
  }
}
export class UnknownModelError extends Error {
  constructor(public readonly modelCode: string) {
    super(`Unknown model code "${modelCode}"`);
    this.name = 'UnknownModelError';
  }
}
export class DeviceConflictError extends Error {
  constructor(public readonly field: 'imei' | 'serialNumber') {
    super(`A device with this ${field} already exists`);
    this.name = 'DeviceConflictError';
  }
}
export class DeviceNotFoundError extends Error {
  constructor(public readonly deviceId: string) {
    super(`Device ${deviceId} not found`);
    this.name = 'DeviceNotFoundError';
  }
}
export class SelfTransferError extends Error {
  constructor() {
    super('Cannot transfer a device to its current owner');
    this.name = 'SelfTransferError';
  }
}
export class OwnershipConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'OwnershipConflictError';
  }
}

export interface DeviceView {
  device: Device;
  state: DeviceState;
  currentOwner: DeviceOwnership | null;
  documents: DeviceDocument[];
}

export class InventoryService {
  constructor(private readonly deps: InventoryDeps) {}

  /** Register an IMEI device with a mandatory supplier invoice (atomic-ish). */
  async registerDevice(input: RegisterDeviceInput, registeredBy: string): Promise<DeviceView> {
    const imei = normalizeImei(input.imei);
    const imei2 = input.imei2 ? normalizeImei(input.imei2) : null;
    if (!isValidImei(imei) || (imei2 !== null && !isValidImei(imei2))) throw new InvalidImeiError();

    const modelName = modelNameFor(input.modelCode);
    if (!isKnownModel(input.modelCode) || modelName === null) {
      throw new UnknownModelError(input.modelCode);
    }

    // Pre-checks; the unique indexes are the backstop against races.
    if (await this.deps.devices.findByImei(imei)) throw new DeviceConflictError('imei');
    if (await this.deps.devices.findBySerial(input.serialNumber)) {
      throw new DeviceConflictError('serialNumber');
    }

    const now = this.deps.clock.now();
    const device = await this.deps.devices.create({
      deviceId: randomUUID(),
      imei,
      imei2,
      serialNumber: input.serialNumber,
      modelCode: input.modelCode,
      modelName,
      storageGb: input.storageGb ?? null,
      color: input.color ?? null,
      condition: input.condition,
      registeredBy,
      createdAt: now,
    });

    // Create the initial ownership + mandatory invoice; roll back the device on failure.
    try {
      await this.deps.ownership.create({
        ownershipId: randomUUID(),
        deviceId: device.deviceId,
        ownerId: registeredBy,
        ownerType: 'vendor',
        acquiredAt: now,
        acquisitionType: 'initial_registration',
        sourceEventId: null,
        releasedAt: null,
        createdAt: now,
      });
      await this.deps.documents.create({
        documentId: randomUUID(),
        deviceId: device.deviceId,
        documentType: input.invoice.documentType,
        s3Bucket: input.invoice.s3Bucket,
        s3Key: input.invoice.s3Key,
        sha256: input.invoice.sha256,
        mimeType: input.invoice.mimeType,
        sizeBytes: input.invoice.sizeBytes,
        uploadedBy: registeredBy,
        uploadedAt: now,
      });
    } catch (err) {
      // Compensate: avoid an orphaned device with no owner/invoice.
      await this.deps.ownership.deleteByDevice(device.deviceId).catch(() => {});
      await this.deps.devices.deleteById(device.deviceId).catch(() => {});
      throw err;
    }

    this.deps.logger.info(
      { event: 'DEVICE_REGISTERED', deviceId: device.deviceId, imei, registeredBy },
      'device registered',
    );
    return this.getDevice(device.deviceId);
  }

  async getDevice(deviceId: string): Promise<DeviceView> {    const device = await this.deps.devices.findById(deviceId);
    if (!device) throw new DeviceNotFoundError(deviceId);
    const currentOwner = await this.deps.ownership.findCurrent(deviceId);
    const documents = await this.deps.documents.listByDevice(deviceId);
    return {
      device,
      state: deriveDeviceState(currentOwner ? currentOwner.ownerType : null),
      currentOwner,
      documents,
    };
  }

  /** Admin audit: a newest-first page of all devices, each with its owner state. */
  async browseDevices(
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{ items: DeviceView[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);
    const { items, total } = await this.deps.devices.listAll(limit, offset);
    const views: DeviceView[] = [];
    for (const device of items) {
      const currentOwner = await this.deps.ownership.findCurrent(device.deviceId);
      views.push({
        device,
        state: deriveDeviceState(currentOwner ? currentOwner.ownerType : null),
        currentOwner,
        documents: [],
      });
    }
    return { items: views, total, limit, offset };
  }

  /** Compliance lookup: resolve a device by its IMEI (for document review). */
  async lookupByImei(imei: string): Promise<DeviceView> {
    const normalized = normalizeImei(imei);
    if (!isValidImei(normalized)) throw new InvalidImeiError();
    const device = await this.deps.devices.findByImei(normalized);
    if (!device) throw new DeviceNotFoundError(normalized);
    return this.getDevice(device.deviceId);
  }

  async listByOwner(ownerId: string): Promise<Device[]> {
    const deviceIds = await this.deps.ownership.listDeviceIdsByCurrentOwner(ownerId);
    const devices: Device[] = [];
    for (const id of deviceIds) {
      const d = await this.deps.devices.findById(id);
      if (d) devices.push(d);
    }
    return devices;
  }

  async addDocument(deviceId: string, input: AddDocumentInput, uploadedBy: string): Promise<DeviceDocument> {
    await this.requireDevice(deviceId);
    const doc = await this.deps.documents.create({
      documentId: randomUUID(),
      deviceId,
      documentType: input.documentType,
      s3Bucket: input.s3Bucket,
      s3Key: input.s3Key,
      sha256: input.sha256,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedBy,
      uploadedAt: this.deps.clock.now(),
    });
    this.deps.logger.info(
      { event: 'DEVICE_DOCUMENT_ADDED', deviceId, documentType: input.documentType, uploadedBy },
      'device document added',
    );
    return doc;
  }

  async presignDocumentUpload(
    deviceId: string,
    documentType: DocumentType,
    contentType: string,
  ): Promise<PresignedUpload> {
    await this.requireDevice(deviceId);
    return this.deps.storage.presignUpload({
      deviceId,
      documentId: randomUUID(),
      documentType,
      contentType,
    });
  }

  /**
   * Presign an upload for a document that belongs to a device that does not
   * exist yet — registration is atomic with its mandatory invoice, so the
   * client uploads first, then passes the returned bucket/key into
   * registerDevice. The object is keyed under an "unassigned" scope.
   */
  async presignRegistrationDocument(
    documentType: DocumentType,
    contentType: string,
  ): Promise<PresignedUpload> {
    return this.deps.storage.presignUpload({
      deviceId: 'unassigned',
      documentId: randomUUID(),
      documentType,
      contentType,
    });
  }

  /**
   * Compliance review: a device's documents, each with a time-limited download
   * URL. The raw s3Bucket/s3Key are not returned — only the presigned GET.
   */
  async listDocumentsForReview(deviceId: string): Promise<
    Array<{
      documentId: string;
      documentType: DocumentType;
      sha256: string;
      mimeType: string;
      sizeBytes: number;
      uploadedBy: string;
      uploadedAt: Date;
      downloadUrl: string;
      expiresAt: Date;
      stub?: boolean;
    }>
  > {
    await this.requireDevice(deviceId);
    const docs = await this.deps.documents.listByDevice(deviceId);
    const out = [];
    for (const d of docs) {
      const dl = await this.deps.storage.presignDownload({ bucket: d.s3Bucket, key: d.s3Key });
      out.push({
        documentId: d.documentId,
        documentType: d.documentType,
        sha256: d.sha256,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        uploadedBy: d.uploadedBy,
        uploadedAt: d.uploadedAt,
        downloadUrl: dl.url,
        expiresAt: dl.expiresAt,
        ...(dl.stub ? { stub: true } : {}),
      });
    }
    return out;
  }

  async transferOwnership(
    deviceId: string,
    input: {
      newOwnerId: string;
      newOwnerType: OwnerType;
      acquisitionType: AcquisitionType;
      sourceEventId?: string;
    },
  ): Promise<DeviceOwnership> {
    await this.requireDevice(deviceId);
    const current = await this.deps.ownership.findCurrent(deviceId);
    if (current && current.ownerId === input.newOwnerId) throw new SelfTransferError();

    const now = this.deps.clock.now();
    const released = await this.deps.ownership.releaseCurrent(deviceId, now);
    if (!released) throw new OwnershipConflictError('no current owner to transfer (or concurrent transfer)');

    const ownership = await this.deps.ownership.create({
      ownershipId: randomUUID(),
      deviceId,
      ownerId: input.newOwnerId,
      ownerType: input.newOwnerType,
      acquiredAt: now,
      acquisitionType: input.acquisitionType,
      sourceEventId: input.sourceEventId ?? null,
      releasedAt: null,
      createdAt: now,
    });
    this.deps.logger.info(
      { event: 'DEVICE_OWNERSHIP_TRANSFERRED', deviceId, from: released.ownerId, to: input.newOwnerId },
      'ownership transferred',
    );
    return ownership;
  }

  private async requireDevice(deviceId: string): Promise<Device> {
    const device = await this.deps.devices.findById(deviceId);
    if (!device) throw new DeviceNotFoundError(deviceId);
    return device;
  }
}
