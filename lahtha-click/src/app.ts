import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { correlationId } from './middleware/correlation-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { createLahthaVendorRouter } from './domains/lahtha/vendor/index.js';
import { createLahthaInventoryRouter } from './domains/lahtha/inventory/index.js';
import { createLahthaCheckoutRouter } from './domains/lahtha/checkout/index.js';
import { createIamModule } from './domains/iam/index.js';
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

  // Workstream 2 — IAM (identity + OTP/sessions + MFA + RBAC, one composition root).
  const iam = createIamModule();
  app.use('/iam', iam.router);
  app.use('/lahtha', createLahthaVendorRouter(iam.authz)); // vendor approval lifecycle (admin routes gated)
  // Workstream 3 — Inventory / IMEI (authorized by the shared IAM session authz).
  app.use('/lahtha/inventory', createLahthaInventoryRouter(iam.authz));
  // Workstream 4 — Checkout (orders) — same session authz; in-process inventory transfer.
  app.use('/lahtha', createLahthaCheckoutRouter(iam.authz));
  // app.use('/click',  clickRouter);  // future

  app.use(errorHandler);
  return app;
}
