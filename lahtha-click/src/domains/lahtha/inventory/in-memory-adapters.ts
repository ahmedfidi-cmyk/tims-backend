// In-memory inventory adapters for tests and as the port reference impl.

import type {
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

export class InMemoryDeviceRepository implements DeviceRepository {
  private readonly byId = new Map<string, Device>();
  async create(device: Device): Promise<Device> {
    this.byId.set(device.deviceId, { ...device });
    return { ...device };
  }
  async findById(deviceId: string): Promise<Device | null> {
    const d = this.byId.get(deviceId);
    return d ? { ...d } : null;
  }
  async findByImei(imei: string): Promise<Device | null> {
    for (const d of this.byId.values()) if (d.imei === imei || d.imei2 === imei) return { ...d };
    return null;
  }
  async findBySerial(serialNumber: string): Promise<Device | null> {
    for (const d of this.byId.values()) if (d.serialNumber === serialNumber) return { ...d };
    return null;
  }
  async deleteById(deviceId: string): Promise<void> {
    this.byId.delete(deviceId);
  }
}

export class InMemoryDeviceOwnershipRepository implements DeviceOwnershipRepository {
  private readonly rows: DeviceOwnership[] = [];
  async create(ownership: DeviceOwnership): Promise<DeviceOwnership> {
    this.rows.push({ ...ownership });
    return { ...ownership };
  }
  async findCurrent(deviceId: string): Promise<DeviceOwnership | null> {
    const row = this.rows.find((r) => r.deviceId === deviceId && r.releasedAt === null);
    return row ? { ...row } : null;
  }
  async releaseCurrent(deviceId: string, when: Date): Promise<DeviceOwnership | null> {
    const row = this.rows.find((r) => r.deviceId === deviceId && r.releasedAt === null);
    if (!row) return null;
    row.releasedAt = when;
    return { ...row };
  }
  async listDeviceIdsByCurrentOwner(ownerId: string): Promise<string[]> {
    return this.rows
      .filter((r) => r.ownerId === ownerId && r.releasedAt === null)
      .map((r) => r.deviceId);
  }
  async deleteByDevice(deviceId: string): Promise<void> {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i]!.deviceId === deviceId) this.rows.splice(i, 1);
    }
  }
}

export class InMemoryDeviceDocumentRepository implements DeviceDocumentRepository {
  private readonly rows: DeviceDocument[] = [];
  async create(doc: DeviceDocument): Promise<DeviceDocument> {
    this.rows.push({ ...doc });
    return { ...doc };
  }
  async listByDevice(deviceId: string): Promise<DeviceDocument[]> {
    return this.rows.filter((r) => r.deviceId === deviceId).map((r) => ({ ...r }));
  }
}

/** Deterministic stub: hands back a fake presigned URL without touching S3. */
export class StubObjectStorage implements ObjectStoragePort {
  constructor(private readonly bucket = 'lahtha-device-docs-dev', private readonly clock?: Clock) {}
  async presignUpload(args: {
    deviceId: string;
    documentId: string;
    documentType: DocumentType;
    contentType: string;
  }): Promise<PresignedUpload> {
    const key = `devices/${args.deviceId}/${args.documentType}/${args.documentId}`;
    const now = this.clock ? this.clock.now() : new Date();
    return {
      bucket: this.bucket,
      key,
      url: `https://${this.bucket}.s3.local/${key}?stub-upload=1`,
      expiresAt: new Date(now.getTime() + 15 * 60_000),
    };
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
