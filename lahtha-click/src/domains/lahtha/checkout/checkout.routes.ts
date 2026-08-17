// HTTP controllers for checkout. Thin: validate (zod), call the service, map
// errors. Authorization is the shared IAM session authz.

import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { paymentEventSchema, placeFromListingSchema, placeOrderSchema, shipSchema } from './schemas.js';
import {
  CheckoutService,
  DeviceUnavailableError,
  ListingUnavailableError,
  NotOrderOwnerError,
  NotSellingVendorError,
  OrderConflictError,
  OrderNotFoundError,
} from './checkout.service.js';
import { InvalidOrderTransition } from './order-state.js';
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
  if (err instanceof OrderNotFoundError) {
    res.status(404).json({ error: 'order_not_found', orderId: err.orderId, correlationId });
    return;
  }
  if (err instanceof DeviceUnavailableError) {
    res.status(409).json({ error: 'device_unavailable', deviceId: err.deviceId, reason: err.reason, correlationId });
    return;
  }
  if (err instanceof ListingUnavailableError) {
    res.status(409).json({ error: 'listing_unavailable', listingId: err.listingId, correlationId });
    return;
  }
  if (err instanceof InvalidOrderTransition) {
    res.status(409).json({ error: 'invalid_order_transition', from: err.from, action: err.action, correlationId });
    return;
  }
  if (err instanceof OrderConflictError) {
    res.status(409).json({ error: 'order_conflict', message: err.message, correlationId });
    return;
  }
  if (err instanceof NotOrderOwnerError || err instanceof NotSellingVendorError) {
    res.status(403).json({ error: 'forbidden', message: err.message, correlationId });
    return;
  }
  next(err);
}

export function createCheckoutRouter(service: CheckoutService, authz: Authz): Router {
  const router = Router();

  // Place an order (buyer).
  router.post(
    '/orders',
    authz.requirePermission('lahtha.order.place'),
    asyncHandler(async (req, res) => {
      const input = placeOrderSchema.parse(req.body);
      const { order, created } = await service.placeOrder(input, req.principalUserId!);
      res.status(created ? 201 : 200).json(order);
    }),
  );

  // Storefront placement: order against an active listing (snapshots its price).
  router.post(
    '/orders/from-listing',
    authz.requirePermission('lahtha.order.place'),
    asyncHandler(async (req, res) => {
      const input = placeFromListingSchema.parse(req.body);
      const { order, created } = await service.placeOrderFromListing(input, req.principalUserId!);
      res.status(created ? 201 : 200).json(order);
    }),
  );

  // Read an order — buyer or selling vendor only.
  router.get(
    '/orders/:orderId',
    authz.requireSession,
    asyncHandler(async (req, res) => {
      const order = await service.getOrder(param(req, 'orderId'));
      const me = req.principalUserId;
      if (me !== order.buyerUserId && me !== order.vendorUserId) {
        res.status(403).json({ error: 'forbidden', correlationId: req.correlationId });
        return;
      }
      res.json(order);
    }),
  );

  // List the caller's orders, as buyer (default) or vendor.
  router.get(
    '/orders',
    authz.requireSession,
    asyncHandler(async (req, res) => {
      const role = req.query.role === 'vendor' ? 'vendor' : 'buyer';
      const items =
        role === 'vendor'
          ? await service.listByVendor(req.principalUserId!)
          : await service.listByBuyer(req.principalUserId!);
      res.json({ items, total: items.length, role });
    }),
  );

  // Buyer cancels while pending payment.
  router.post(
    '/orders/:orderId/cancel',
    authz.requireSession,
    asyncHandler(async (req, res) => {
      const order = await service.cancel(param(req, 'orderId'), req.principalUserId!);
      res.json(order);
    }),
  );

  // Payment provider result seam (W5 drives this); admin/ops gated for now.
  router.post(
    '/orders/:orderId/payment-event',
    authz.requirePermission('lahtha.state.override'),
    asyncHandler(async (req, res) => {
      const input = paymentEventSchema.parse(req.body);
      const order = await service.applyPaymentResult(param(req, 'orderId'), input.outcome, input.paymentRef);
      res.json(order);
    }),
  );

  router.post(
    '/orders/:orderId/ship',
    authz.requirePermission('lahtha.state.override'),
    asyncHandler(async (req, res) => {
      const input = shipSchema.parse(req.body);
      const order = await service.ship(param(req, 'orderId'), input.shippingRef);
      res.json(order);
    }),
  );

  router.post(
    '/orders/:orderId/deliver',
    authz.requirePermission('lahtha.state.override'),
    asyncHandler(async (req, res) => {
      const order = await service.deliver(param(req, 'orderId'));
      res.json(order);
    }),
  );

  // Selling vendor ships their own order (AWAITING_FULFILLMENT → SHIPPED).
  router.post(
    '/orders/:orderId/fulfill',
    authz.requirePermission('lahtha.order.fulfill'),
    asyncHandler(async (req, res) => {
      const input = shipSchema.parse(req.body);
      const order = await service.shipByVendor(param(req, 'orderId'), input.shippingRef, req.principalUserId!);
      res.json(order);
    }),
  );

  // Buyer confirms receipt of their own order (SHIPPED → COMPLETED).
  router.post(
    '/orders/:orderId/confirm-receipt',
    authz.requireSession,
    asyncHandler(async (req, res) => {
      const order = await service.confirmReceipt(param(req, 'orderId'), req.principalUserId!);
      res.json(order);
    }),
  );

  router.post(
    '/orders/:orderId/refund',
    authz.requirePermission('lahtha.order.refund'),
    asyncHandler(async (req, res) => {
      const order = await service.refund(param(req, 'orderId'));
      res.json(order);
    }),
  );

  // Admin dashboard: platform-wide GMV/commission/vendor/monthly-growth aggregation.
  router.get(
    '/admin/analytics',
    authz.requirePermission('platform.analytics.view'),
    asyncHandler(async (_req, res) => {
      res.json(await service.getAdminAnalytics());
    }),
  );

  return router;
}
