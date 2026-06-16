// HTTP controllers for listings. Browse is public; create/withdraw need a session.

import { Router, type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import {
  DeviceNotListableError,
  ListingConflictError,
  ListingNotFoundError,
  ListingService,
  NotListingOwnerError,
} from './listing.service.js';
import { InvalidListingTransition } from './listing-state.js';
import type { Authz } from '../../iam/authz.js';

const createSchema = z.object({
  deviceId: z.string().trim().min(1),
  priceHalalat: z.number().int().positive(),
});

function param(req: Request, name: string): string {
  return req.params[name] ?? '';
}
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch((err: unknown) => mapError(err, req, res, next));
  };
}
function mapError(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.correlationId;
  if (err instanceof ZodError) return void res.status(400).json({ error: 'validation_error', issues: err.issues, correlationId });
  if (err instanceof ListingNotFoundError) return void res.status(404).json({ error: 'listing_not_found', correlationId });
  if (err instanceof DeviceNotListableError) return void res.status(422).json({ error: 'device_not_listable', reason: err.reason, correlationId });
  if (err instanceof ListingConflictError) return void res.status(409).json({ error: 'listing_conflict', message: err.message, correlationId });
  if (err instanceof NotListingOwnerError) return void res.status(403).json({ error: 'forbidden', correlationId });
  if (err instanceof InvalidListingTransition) return void res.status(409).json({ error: 'invalid_listing_transition', from: err.from, correlationId });
  next(err);
}

export function createListingRouter(service: ListingService, authz: Authz): Router {
  const router = Router();

  // Public browse — listings with a device summary.
  router.get('/listings', asyncHandler(async (_req, res) => {
    const items = await service.browse();
    res.json({ items, total: items.length });
  }));

  // Vendor's own listings (must precede /listings/:id).
  router.get('/listings/mine', authz.requireSession, asyncHandler(async (req, res) => {
    const items = await service.listByVendor(req.principalUserId!);
    res.json({ items, total: items.length });
  }));

  router.get('/listings/:listingId', asyncHandler(async (req, res) => {
    res.json(await service.getDetailed(param(req, 'listingId')));
  }));

  // Vendor lists an owned device.
  router.post('/listings', authz.requirePermission('lahtha.vendor.manage_profile'), asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const listing = await service.createListing(input, req.principalUserId!);
    res.status(201).json(listing);
  }));

  router.post('/listings/:listingId/withdraw', authz.requireSession, asyncHandler(async (req, res) => {
    const listing = await service.withdraw(param(req, 'listingId'), req.principalUserId!);
    res.json(listing);
  }));

  return router;
}
