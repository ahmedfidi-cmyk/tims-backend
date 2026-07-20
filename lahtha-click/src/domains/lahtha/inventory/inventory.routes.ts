// HTTP controllers for inventory. Thin: validate (zod), call the service, map
// errors. Authorization is the IAM session-based authz (permission per route).

import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { addDocumentSchema, presignSchema, registerDeviceSchema, transferSchema } from './schemas.js';
import {
  DeviceConflictError,
  DeviceNotFoundError,
  InvalidImeiError,
  InventoryService,
  OwnershipConflictError,
  SelfTransferError,
  UnknownModelError,
} from './inventory.service.js';
import { listModels } from './model-catalog.js';
import type { Authz } from '../../iam/authz.js';

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
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation_error', issues: err.issues, correlationId });
    return;
  }
  if (err instanceof InvalidImeiError) {
    res.status(400).json({ error: 'invalid_imei', correlationId });
    return;
  }
  if (err instanceof UnknownModelError) {
    res.status(422).json({ error: 'unknown_model', modelCode: err.modelCode, correlationId });
    return;
  }
  if (err instanceof DeviceConflictError) {
    res.status(409).json({ error: 'device_conflict', field: err.field, correlationId });
    return;
  }
  if (err instanceof DeviceNotFoundError) {
    res.status(404).json({ error: 'device_not_found', deviceId: err.deviceId, correlationId });
    return;
  }
  if (err instanceof SelfTransferError) {
    res.status(422).json({ error: 'self_transfer', correlationId });
    return;
  }
  if (err instanceof OwnershipConflictError) {
    res.status(409).json({ error: 'ownership_conflict', message: err.message, correlationId });
    return;
  }
  next(err);
}

export function createInventoryRouter(service: InventoryService, authz: Authz): Router {
  const router = Router();

  // Reference data — model code allowlist (no auth required).
  router.get('/models', (_req: Request, res: Response) => {
    res.json({ items: listModels() });
  });

  router.post(
    '/devices',
    authz.requirePermission('lahtha.device.register'),
    asyncHandler(async (req, res) => {
      const input = registerDeviceSchema.parse(req.body);
      const view = await service.registerDevice(input, req.principalUserId!);
      res.status(201).json(view);
    }),
  );

  router.get(
    '/devices',
    authz.requirePermission('lahtha.device.list'),
    asyncHandler(async (req, res) => {
      const ownerId = typeof req.query.ownerId === 'string' ? req.query.ownerId : req.principalUserId!;
      const items = await service.listByOwner(ownerId);
      res.json({ items, total: items.length });
    }),
  );

  // Admin oversight: newest-first page of all devices. Gated by device.audit.
  router.get(
    '/admin/devices',
    authz.requirePermission('lahtha.device.audit'),
    asyncHandler(async (req, res) => {
      const limit = Number(req.query.limit) || undefined;
      const offset = Number(req.query.offset) || undefined;
      const page = await service.browseDevices({ limit, offset });
      res.json(page);
    }),
  );

  // Compliance device lookup by IMEI (registered before :deviceId so "lookup"
  // is not captured as a deviceId). Gated by document.review.
  router.get(
    '/devices/lookup',
    authz.requirePermission('lahtha.document.review'),
    asyncHandler(async (req, res) => {
      const imei = typeof req.query.imei === 'string' ? req.query.imei : '';
      const { device, state, currentOwner } = await service.lookupByImei(imei);
      res.json({ device, state, currentOwner });
    }),
  );

  router.get(
    '/devices/:deviceId',
    authz.requirePermission('lahtha.device.list'),
    asyncHandler(async (req, res) => {
      const view = await service.getDevice(param(req, 'deviceId'));
      res.json(view);
    }),
  );

  // Registration-scoped presign: the device does not exist yet (its invoice is
  // mandatory and atomic), so this is gated by device.register, not document.upload.
  router.post(
    '/documents/upload-url',
    authz.requirePermission('lahtha.device.register'),
    asyncHandler(async (req, res) => {
      const input = presignSchema.parse(req.body);
      const presigned = await service.presignRegistrationDocument(input.documentType, input.contentType);
      res.json(presigned);
    }),
  );

  router.post(
    '/devices/:deviceId/documents/upload-url',
    authz.requirePermission('lahtha.document.upload'),
    asyncHandler(async (req, res) => {
      const input = presignSchema.parse(req.body);
      const presigned = await service.presignDocumentUpload(
        param(req, 'deviceId'),
        input.documentType,
        input.contentType,
      );
      res.json(presigned);
    }),
  );

  router.post(
    '/devices/:deviceId/documents',
    authz.requirePermission('lahtha.document.upload'),
    asyncHandler(async (req, res) => {
      const input = addDocumentSchema.parse(req.body);
      const doc = await service.addDocument(param(req, 'deviceId'), input, req.principalUserId!);
      res.status(201).json(doc);
    }),
  );

  // Compliance review: list a device's documents with time-limited download URLs.
  router.get(
    '/devices/:deviceId/documents',
    authz.requirePermission('lahtha.document.review'),
    asyncHandler(async (req, res) => {
      const items = await service.listDocumentsForReview(param(req, 'deviceId'));
      res.json({ items, total: items.length });
    }),
  );

  // Ownership transfer / custody — internal, admin-gated.
  router.post(
    '/devices/:deviceId/transfer',
    authz.requirePermission('lahtha.state.override'),
    asyncHandler(async (req, res) => {
      const input = transferSchema.parse(req.body);
      const ownership = await service.transferOwnership(param(req, 'deviceId'), {
        newOwnerId: input.newOwnerId,
        newOwnerType: input.newOwnerType,
        acquisitionType: input.acquisitionType,
        ...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}),
      });
      res.status(201).json(ownership);
    }),
  );

  return router;
}
