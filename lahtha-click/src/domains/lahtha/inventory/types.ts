// Inventory entities and hexagonal ports. Self-contained: no Express/Mongoose,
// and no dependency on the IAM service (authorization is applied at the router).

import type { AcquisitionType, OwnerType } from './device-state.js';

export const DEVICE_CONDITIONS = ['new_sealed', 'open_box', 'refurbished', 'used'] as const;
export type DeviceCondition = (typeof DEVICE_CONDITIONS)[number];

export const DOCUMENT_TYPES = [
  'supplier_invoice',
  'customs_clearance',
  'imei_certificate',
  'box_photo',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface Device {
  deviceId: string;
  imei: string;
  imei2: string | null;
  serialNumber: string;
  modelCode: string;
  modelName: string;
  storageGb: number | null;
  color: string | null;
  condition: DeviceCondition;
  registeredBy: string; // RBAC userId
  createdAt: Date;
}

export interface DeviceOwnership {
  ownershipId: string;
  deviceId: string;
  ownerId: string;
  ownerType: OwnerType;
  acquiredAt: Date;
  acquisitionType: AcquisitionType;
  sourceEventId: string | null;
  releasedAt: Date | null;
  createdAt: Date;
}

export interface DeviceDocument {
  documentId: string;
  deviceId: string;
  documentType: DocumentType;
  s3Bucket: string;
  s3Key: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: Date;
}

// --- Ports ---

export interface DeviceRepository {
  create(device: Device): Promise<Device>;
  findById(deviceId: string): Promise<Device | null>;
  findByImei(imei: string): Promise<Device | null>;
  findBySerial(serialNumber: string): Promise<Device | null>;
  /** Compensation only — used to roll back a partial registration. */
  deleteById(deviceId: string): Promise<void>;
}

export interface DeviceOwnershipRepository {
  create(ownership: DeviceOwnership): Promise<DeviceOwnership>;
  findCurrent(deviceId: string): Promise<DeviceOwnership | null>;
  /**
   * Atomically release the current owner (compare-and-set on releasedAt=null).
   * Returns the released row, or null if there was no current owner (lost race).
   */
  releaseCurrent(deviceId: string, when: Date): Promise<DeviceOwnership | null>;
  listDeviceIdsByCurrentOwner(ownerId: string): Promise<string[]>;
  deleteByDevice(deviceId: string): Promise<void>;
}

export interface DeviceDocumentRepository {
  create(doc: DeviceDocument): Promise<DeviceDocument>;
  listByDevice(deviceId: string): Promise<DeviceDocument[]>;
}

export interface PresignedUpload {
  bucket: string;
  key: string;
  url: string;
  expiresAt: Date;
  /** True for the dev stub — the client must NOT attempt a real PUT to `url`. */
  stub?: boolean;
}

/** Object storage seam (S3 in production; stub in Phase 1). */
export interface ObjectStoragePort {
  presignUpload(args: {
    deviceId: string;
    documentId: string;
    documentType: DocumentType;
    contentType: string;
  }): Promise<PresignedUpload>;
}

export interface Clock {
  now(): Date;
}

export interface AuditLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
}
