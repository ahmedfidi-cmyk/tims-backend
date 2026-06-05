// HTTP layer for vendor approval. Thin: validate input (zod), call the service,
// map domain errors to status codes. Mounted at /lahtha by the app factory.

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  ConcurrencyError,
  VendorApprovalService,
  VendorNotFoundError,
  type TransitionContext,
} from './vendor.service.js';
import { InvalidTransitionError } from './vendor-approval.js';
import type { Vendor as VendorRecord } from './types.js';

const ACTOR_HEADER = 'x-actor-id';

const registerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email(),
});

const proofSchema = z.object({
  proofRef: z.string().trim().min(1).max(1024),
});

const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

function actorFrom(req: Request, fallback: string): string {
  const header = req.header(ACTOR_HEADER);
  return header && header.trim().length > 0 ? header.trim() : fallback;
}

function ctxFrom(req: Request, fallbackActor: string): TransitionContext {
  return { actor: actorFrom(req, fallbackActor), correlationId: req.correlationId };
}

/** Read a declared route param (always present for matched routes). */
function param(req: Request, name: string): string {
  return req.params[name] ?? '';
}

function vendorView(v: VendorRecord): Record<string, unknown> {
  return {
    vendorId: v.vendorId,
    name: v.name,
    contactEmail: v.contactEmail,
    status: v.status,
    ownershipProofRef: v.ownershipProofRef,
    rejectionReason: v.rejectionReason,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

/** Wrap an async handler so thrown domain errors become proper HTTP responses. */
function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).catch((err: unknown) => mapError(err, req, res, next));
  };
}

function mapError(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.correlationId;
  if (err instanceof VendorNotFoundError) {
    res.status(404).json({ error: 'vendor_not_found', vendorId: err.vendorId, correlationId });
    return;
  }
  if (err instanceof InvalidTransitionError) {
    res.status(409).json({
      error: 'invalid_state_transition',
      message: err.message,
      from: err.from,
      action: err.action,
      correlationId,
    });
    return;
  }
  if (err instanceof ConcurrencyError) {
    res.status(409).json({ error: 'concurrent_modification', message: err.message, correlationId });
    return;
  }
  // Unknown — hand off to the global error handler (logs + 500).
  next(err);
}

export function createVendorRouter(service: VendorApprovalService): Router {
  const router = Router();

  // Register a new vendor (self-service signup entry point).
  router.post(
    '/vendors',
    asyncHandler(async (req, res) => {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'validation_error', issues: parsed.error.issues });
        return;
      }
      const vendor = await service.register(parsed.data, ctxFrom(req, 'SYSTEM_REGISTRATION'));
      res.status(201).json(vendorView(vendor));
    }),
  );

  router.get(
    '/vendors/:vendorId',
    asyncHandler(async (req, res) => {
      const vendor = await service.getById(param(req, 'vendorId'));
      res.json(vendorView(vendor));
    }),
  );

  // Vendor submits ownership/CR/VAT proof -> enters review.
  router.post(
    '/vendors/:vendorId/ownership-proof',
    asyncHandler(async (req, res) => {
      const parsed = proofSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'validation_error', issues: parsed.error.issues });
        return;
      }
      const vendor = await service.submitOwnershipProof(
        param(req, 'vendorId'),
        parsed.data.proofRef,
        ctxFrom(req, `vendor:${param(req, 'vendorId')}`),
      );
      res.json(vendorView(vendor));
    }),
  );

  // Rule 4 gate: is this vendor cleared to participate in CLICK?
  router.get(
    '/vendors/:vendorId/click-access',
    asyncHandler(async (req, res) => {
      const result = await service.getClickAccess(param(req, 'vendorId'));
      res.json(result);
    }),
  );

  // Audit trail (Rule 20) for a single vendor.
  router.get(
    '/vendors/:vendorId/audit',
    asyncHandler(async (req, res) => {
      const entries = await service.getAuditTrail(param(req, 'vendorId'));
      res.json({ items: entries, total: entries.length });
    }),
  );

  // --- Admin actions ---

  router.post(
    '/admin/vendors/:vendorId/approve',
    asyncHandler(async (req, res) => {
      const vendor = await service.approve(param(req, 'vendorId'), ctxFrom(req, 'admin'));
      res.json(vendorView(vendor));
    }),
  );

  router.post(
    '/admin/vendors/:vendorId/reject',
    asyncHandler(async (req, res) => {
      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'validation_error', issues: parsed.error.issues });
        return;
      }
      const vendor = await service.reject(
        param(req, 'vendorId'),
        parsed.data.reason,
        ctxFrom(req, 'admin'),
      );
      res.json(vendorView(vendor));
    }),
  );

  return router;
}
