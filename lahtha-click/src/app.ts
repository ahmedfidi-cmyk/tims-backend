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

  // LAHTHA domain (Workstream 2 — IAM): vendor approval lifecycle.
  app.use('/lahtha', createLahthaVendorRouter());
  // app.use('/click',  clickRouter);  // future

  app.use(errorHandler);
  return app;
}
