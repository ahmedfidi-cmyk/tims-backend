import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { correlationId } from './middleware/correlation-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import {
  createLahthaVendorRouter,
  createVendorApprovalService,
  makeApprovalProvisioner,
  RbacVendorActivation,
} from './domains/lahtha/vendor/index.js';
import { createLahthaInventoryRouter } from './domains/lahtha/inventory/index.js';
import { createCheckoutService, createLahthaCheckoutRouter } from './domains/lahtha/checkout/index.js';
import { createLahthaPaymentRouter, createPaymentService } from './domains/lahtha/payment/index.js';
import {
  createLahthaListingRouter,
  createListingService,
  makeListingQueryPort,
  makeListingSoldPort,
} from './domains/lahtha/listing/index.js';
import { createIamModule, createRbacService } from './domains/iam/index.js';
import { logger } from './lib/logger.js';

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(
      {
        correlationId: req.correlationId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      },
      'request',
    );
  });
  next();
}

export function createApp(): Express {
  const app = express();

  app.use(correlationId);
  app.use(requestLogger);
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);

  // Composition (linear, no cycle): RBAC → vendor-approval (activation over RBAC)
  // → IAM module (provisions the linked approval record at signup). See ADR-0005.
  const rbac = createRbacService();
  const vendorApproval = createVendorApprovalService(new RbacVendorActivation(rbac));
  const iam = createIamModule({ rbac, approvalProvisioner: makeApprovalProvisioner(vendorApproval) });
  app.use('/iam', iam.router);
  app.use('/lahtha', createLahthaVendorRouter(vendorApproval, iam.authz)); // vendor approval lifecycle (admin gated)
  // Workstream 3 — Inventory / IMEI (authorized by the shared IAM session authz).
  app.use('/lahtha/inventory', createLahthaInventoryRouter(iam.authz));
  // Listings (storefront offers, ADR-0006) — checkout places from a listing + marks it sold.
  const listing = createListingService();
  app.use('/lahtha', createLahthaListingRouter(listing, iam.authz));
  // Workstream 4 — Checkout (orders) — same session authz; in-process inventory transfer.
  const checkout = createCheckoutService({
    listings: makeListingQueryPort(listing),
    listingSold: makeListingSoldPort(listing),
    rbac,
  });
  app.use('/lahtha', createLahthaCheckoutRouter(checkout, iam.authz));
  // Payments (ADR-0007) — drives the checkout payment seam; stub auto-captures in dev.
  app.use('/lahtha', createLahthaPaymentRouter(createPaymentService(checkout), iam.authz));
  // app.use('/click',  clickRouter);  // future

  app.use(errorHandler);
  return app;
}
