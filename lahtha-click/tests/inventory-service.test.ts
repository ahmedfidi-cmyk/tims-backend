import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeviceConflictError,
  DeviceNotFoundError,
  InvalidImeiError,
  InventoryService,
  SelfTransferError,
  UnknownModelError,
} from '../src/domains/lahtha/inventory/inventory.service.js';
import {
  FixedClock,
  InMemoryDeviceDocumentRepository,
  InMemoryDeviceOwnershipRepository,
  InMemoryDeviceRepository,
  StubObjectStorage,
} from '../src/domains/lahtha/inventory/in-memory-adapters.js';
import { withLuhn } from './inventory-core.test.js';

const silentLogger = { info: () => {}, warn: () => {} };
const SHA = 'a'.repeat(64);

function build() {
  const clock = new FixedClock(new Date('2026-06-06T00:00:00Z'));
  const service = new InventoryService({
    devices: new InMemoryDeviceRepository(),
    ownership: new InMemoryDeviceOwnershipRepository(),
    documents: new InMemoryDeviceDocumentRepository(),
    storage: new StubObjectStorage('test-bucket', clock),
    clock,
    logger: silentLogger,
  });
  return { service, clock };
}

function registration(overrides: Record<string, unknown> = {}) {
  return {
    imei: withLuhn('49015420323751'),
    serialNumber: 'SN-' + Math.random().toString(36).slice(2),
    modelCode: 'A3105',
    condition: 'new_sealed' as const,
    invoice: {
      documentType: 'supplier_invoice' as const,
      s3Bucket: 'b',
      s3Key: 'k-' + Math.random().toString(36).slice(2),
      sha256: SHA,
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    },
    ...overrides,
  };
}

describe('InventoryService', () => {
  let service: InventoryService;
  beforeEach(() => {
    service = build().service;
  });

  it('registers a device with initial vendor ownership + invoice', async () => {
    const view = await service.registerDevice(registration(), 'vendor-1');
    expect(view.state).toBe('with_vendor');
    expect(view.currentOwner?.ownerId).toBe('vendor-1');
    expect(view.currentOwner?.acquisitionType).toBe('initial_registration');
    expect(view.documents).toHaveLength(1);
    expect(view.documents[0]?.documentType).toBe('supplier_invoice');
    expect(view.device.modelName).toBe('iPhone 17 Pro');
  });

  it('rejects an invalid IMEI checksum', async () => {
    await expect(
      service.registerDevice(registration({ imei: '490154203237519' }), 'v'),
    ).rejects.toBeInstanceOf(InvalidImeiError);
  });

  it('rejects an unknown model code', async () => {
    await expect(
      service.registerDevice(registration({ modelCode: 'Z9999' }), 'v'),
    ).rejects.toBeInstanceOf(UnknownModelError);
  });

  it('enforces global IMEI uniqueness', async () => {
    const imei = withLuhn('35693803564380');
    await service.registerDevice(registration({ imei }), 'v1');
    await expect(
      service.registerDevice(registration({ imei }), 'v2'),
    ).rejects.toBeInstanceOf(DeviceConflictError);
  });

  it('enforces serial uniqueness', async () => {
    await service.registerDevice(registration({ serialNumber: 'DUP' }), 'v1');
    await expect(
      service.registerDevice(registration({ serialNumber: 'DUP', imei: withLuhn('35209900176148') }), 'v2'),
    ).rejects.toBeInstanceOf(DeviceConflictError);
  });

  it('lists devices by current owner', async () => {
    const v = await service.registerDevice(registration(), 'vendor-1');
    const list = await service.listByOwner('vendor-1');
    expect(list.map((d) => d.deviceId)).toContain(v.device.deviceId);
  });

  it('adds a document to an existing device', async () => {
    const v = await service.registerDevice(registration(), 'vendor-1');
    const doc = await service.addDocument(
      v.device.deviceId,
      {
        documentType: 'imei_certificate',
        s3Bucket: 'b',
        s3Key: 'cert-1',
        sha256: SHA,
        mimeType: 'application/pdf',
        sizeBytes: 2048,
      },
      'vendor-1',
    );
    expect(doc.documentType).toBe('imei_certificate');
    const view = await service.getDevice(v.device.deviceId);
    expect(view.documents).toHaveLength(2);
  });

  it('presigns a document upload via the storage port', async () => {
    const v = await service.registerDevice(registration(), 'vendor-1');
    const presigned = await service.presignDocumentUpload(v.device.deviceId, 'box_photo', 'image/jpeg');
    expect(presigned.url).toContain(v.device.deviceId);
    // Stub uses the injected (fixed) clock: expiry is 15 min after that.
    expect(presigned.expiresAt.getTime()).toBe(new Date('2026-06-06T00:15:00Z').getTime());
  });

  describe('ownership transfer', () => {
    it('transfers to a new owner and updates current ownership', async () => {
      const v = await service.registerDevice(registration(), 'vendor-1');
      await service.transferOwnership(v.device.deviceId, {
        newOwnerId: 'lahtha',
        newOwnerType: 'lahtha_custody',
        acquisitionType: 'transfer_in',
      });
      const view = await service.getDevice(v.device.deviceId);
      expect(view.currentOwner?.ownerId).toBe('lahtha');
      expect(view.state).toBe('in_custody');
      expect(await service.listByOwner('vendor-1')).toHaveLength(0);
      expect(await service.listByOwner('lahtha')).toHaveLength(1);
    });

    it('rejects a self-transfer', async () => {
      const v = await service.registerDevice(registration(), 'vendor-1');
      await expect(
        service.transferOwnership(v.device.deviceId, {
          newOwnerId: 'vendor-1',
          newOwnerType: 'vendor',
          acquisitionType: 'transfer_in',
        }),
      ).rejects.toBeInstanceOf(SelfTransferError);
    });

    it('404s for an unknown device', async () => {
      await expect(
        service.transferOwnership('nope', {
          newOwnerId: 'x',
          newOwnerType: 'vendor',
          acquisitionType: 'transfer_in',
        }),
      ).rejects.toBeInstanceOf(DeviceNotFoundError);
    });
  });
});
