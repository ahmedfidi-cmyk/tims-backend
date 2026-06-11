// Vendor approval service — orchestrates the pure state machine, persistence,
// and the audit ledger. No HTTP or framework concerns live here.

import { randomUUID } from 'node:crypto';
import type { AuditEntry, AuditRepository, Vendor, VendorRepository } from './types.js';
import {
  applyTransition,
  canParticipateInClick,
  INITIAL_STATE,
  VENDOR_ACTIONS,
  type VendorAction,
  type VendorState,
} from './vendor-approval.js';

const ENTITY_TYPE = 'VENDOR';

/** Raised when a vendor id does not resolve. */
export class VendorNotFoundError extends Error {
  readonly vendorId: string;
  constructor(vendorId: string) {
    super(`Vendor ${vendorId} not found`);
    this.name = 'VendorNotFoundError';
    this.vendorId = vendorId;
  }
}

/** Raised when a concurrent update wins the race for a state change. */
export class ConcurrencyError extends Error {
  constructor(vendorId: string) {
    super(`Vendor ${vendorId} was modified concurrently; retry`);
    this.name = 'ConcurrencyError';
  }
}

export interface RegisterVendorInput {
  name: string;
  contactEmail: string;
}

export interface TransitionContext {
  actor: string;
  correlationId?: string | null;
}

export class VendorApprovalService {
  constructor(
    private readonly vendors: VendorRepository,
    private readonly audit: AuditRepository,
  ) {}

  /** Register a new vendor in PENDING_OWNERSHIP_PROOF. */
  async register(input: RegisterVendorInput, ctx: TransitionContext): Promise<Vendor> {
    const now = new Date();
    const vendor = await this.vendors.create({
      vendorId: randomUUID(),
      name: input.name,
      contactEmail: input.contactEmail,
      status: INITIAL_STATE,
      createdAt: now,
      updatedAt: now,
    });

    await this.writeAudit({
      entityId: vendor.vendorId,
      action: VENDOR_ACTIONS.REGISTER,
      previousState: 'NONE',
      newState: vendor.status,
      actor: ctx.actor,
      correlationId: ctx.correlationId ?? null,
      metadata: { contactEmail: vendor.contactEmail },
    });

    return vendor;
  }

  /** Submit ownership proof — moves the vendor into PENDING_REVIEW. */
  async submitOwnershipProof(
    vendorId: string,
    proofRef: string,
    ctx: TransitionContext,
  ): Promise<Vendor> {
    return this.transition(vendorId, VENDOR_ACTIONS.SUBMIT_PROOF, ctx, {
      ownershipProofRef: proofRef,
    }, { proofRef });
  }

  /** Admin approval — only valid from PENDING_REVIEW (Rule 4 prerequisite). */
  async approve(vendorId: string, ctx: TransitionContext): Promise<Vendor> {
    return this.transition(vendorId, VENDOR_ACTIONS.APPROVE, ctx, {}, {});
  }

  /** Admin rejection with a mandatory reason; vendor may later resubmit. */
  async reject(vendorId: string, reason: string, ctx: TransitionContext): Promise<Vendor> {
    return this.transition(vendorId, VENDOR_ACTIONS.REJECT, ctx, {
      rejectionReason: reason,
    }, { reason });
  }

  async getById(vendorId: string): Promise<Vendor> {
    const vendor = await this.vendors.findById(vendorId);
    if (!vendor) throw new VendorNotFoundError(vendorId);
    return vendor;
  }

  /** Rule 4 gate: report whether the vendor may participate in CLICK. */
  async getClickAccess(vendorId: string): Promise<{ vendorId: string; status: VendorState; clickAccess: boolean }> {
    const vendor = await this.getById(vendorId);
    return {
      vendorId: vendor.vendorId,
      status: vendor.status,
      clickAccess: canParticipateInClick(vendor.status),
    };
  }

  async getAuditTrail(vendorId: string): Promise<AuditEntry[]> {
    // Surface a clear 404 rather than an empty list for an unknown vendor.
    await this.getById(vendorId);
    return this.audit.listForEntity(vendorId);
  }

  /** Admin review queue: vendors in a given lifecycle state, oldest first. */
  async listByStatus(status: VendorState, limit?: number): Promise<Vendor[]> {
    return this.vendors.listByStatus(status, limit);
  }

  /** Shared transition path: validate (pure) → persist (guarded) → audit. */
  private async transition(
    vendorId: string,
    action: VendorAction,
    ctx: TransitionContext,
    patch: Partial<Pick<Vendor, 'ownershipProofRef' | 'rejectionReason'>>,
    metadata: Record<string, unknown>,
  ): Promise<Vendor> {
    const current = await this.getById(vendorId);
    // Throws InvalidTransitionError if the action is illegal from this state.
    const nextState = applyTransition(current.status, action);

    const updated = await this.vendors.updateState(vendorId, current.status, {
      status: nextState,
      ...patch,
    });
    if (!updated) throw new ConcurrencyError(vendorId);

    await this.writeAudit({
      entityId: vendorId,
      action,
      previousState: current.status,
      newState: nextState,
      actor: ctx.actor,
      correlationId: ctx.correlationId ?? null,
      metadata,
    });

    return updated;
  }

  private async writeAudit(args: {
    entityId: string;
    action: VendorAction;
    previousState: string;
    newState: string;
    actor: string;
    correlationId: string | null;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.audit.append({
      logId: randomUUID(),
      entityId: args.entityId,
      entityType: ENTITY_TYPE,
      action: args.action,
      previousState: args.previousState,
      newState: args.newState,
      actor: args.actor,
      metadata: args.metadata,
      correlationId: args.correlationId,
      timestamp: new Date(),
    });
  }
}
