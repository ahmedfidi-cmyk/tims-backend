// Vendor approval — shared types and persistence ports.
//
// The service depends on these interfaces, not on Mongoose directly. That keeps
// the business logic testable with an in-memory implementation (no live DB) and
// swappable for the Mongo-backed implementation in production — the dependency
// inversion the architecture docs call for.

import type { VendorAction, VendorState } from './vendor-approval.js';

/** A vendor record as stored and returned by the API. */
export interface Vendor {
  vendorId: string;
  name: string;
  contactEmail: string;
  status: VendorState;
  /** Linked RBAC user (the vendor principal); null for legacy unlinked records. */
  userId: string | null;
  /** Reference to the latest ownership-proof document (e.g. S3 key). */
  ownershipProofRef: string | null;
  /** Reason captured on the most recent rejection, if any. */
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** An append-only audit record (Rule 20). */
export interface AuditEntry {
  logId: string;
  entityId: string;
  entityType: string;
  action: VendorAction;
  previousState: string;
  newState: string;
  actor: string;
  /** Free-form context (e.g. rejection reason, proof reference). */
  metadata: Record<string, unknown>;
  correlationId: string | null;
  timestamp: Date;
}

/** Fields needed to create a vendor. */
export interface NewVendor {
  vendorId: string;
  name: string;
  contactEmail: string;
  status: VendorState;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cross-domain port: on approval, onboard the linked RBAC account (activate the
 * user + grant the default vendor role). Implemented over the RBAC service.
 */
export interface VendorActivationPort {
  onVendorApproved(userId: string): Promise<void>;
}

/** Persistence port for vendors. */
export interface VendorRepository {
  create(vendor: NewVendor): Promise<Vendor>;
  findById(vendorId: string): Promise<Vendor | null>;
  /**
   * Persist a state change. Implementations must guard against lost updates:
   * the write only succeeds if the stored status still equals expectedFrom.
   * Returns null if that precondition fails (concurrent modification).
   */
  updateState(
    vendorId: string,
    expectedFrom: VendorState,
    patch: Partial<Pick<Vendor, 'status' | 'ownershipProofRef' | 'rejectionReason'>>,
  ): Promise<Vendor | null>;
  /** Admin queue: vendors in a given lifecycle state, oldest first. */
  listByStatus(status: VendorState, limit?: number): Promise<Vendor[]>;
}

/** Persistence port for the append-only audit ledger. */
export interface AuditRepository {
  append(entry: AuditEntry): Promise<void>;
  listForEntity(entityId: string): Promise<AuditEntry[]>;
}
