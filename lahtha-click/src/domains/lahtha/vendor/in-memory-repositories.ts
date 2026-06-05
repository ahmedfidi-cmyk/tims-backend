// In-memory implementations of the vendor + audit ports.
//
// Used by the test suite (which, per the repo's convention, does not require a
// live MongoDB) and usable as a reference for the persistence contract.

import type {
  AuditEntry,
  AuditRepository,
  NewVendor,
  Vendor,
  VendorRepository,
} from './types.js';
import type { VendorState } from './vendor-approval.js';

export class InMemoryVendorRepository implements VendorRepository {
  private readonly store = new Map<string, Vendor>();

  async create(vendor: NewVendor): Promise<Vendor> {
    const record: Vendor = {
      ...vendor,
      ownershipProofRef: null,
      rejectionReason: null,
    };
    this.store.set(record.vendorId, record);
    return { ...record };
  }

  async findById(vendorId: string): Promise<Vendor | null> {
    const found = this.store.get(vendorId);
    return found ? { ...found } : null;
  }

  async updateState(
    vendorId: string,
    expectedFrom: VendorState,
    patch: Partial<Pick<Vendor, 'status' | 'ownershipProofRef' | 'rejectionReason'>>,
  ): Promise<Vendor | null> {
    const current = this.store.get(vendorId);
    // Optimistic guard: only apply if the state hasn't moved under us.
    if (!current || current.status !== expectedFrom) return null;
    const updated: Vendor = { ...current, ...patch, updatedAt: new Date() };
    this.store.set(vendorId, updated);
    return { ...updated };
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  private readonly entries: AuditEntry[] = [];

  async append(entry: AuditEntry): Promise<void> {
    // Append-only: never mutate or delete existing entries (Rule 20).
    this.entries.push({ ...entry });
  }

  async listForEntity(entityId: string): Promise<AuditEntry[]> {
    return this.entries
      .filter((e) => e.entityId === entityId)
      .map((e) => ({ ...e }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}
