import express, { type Express, type Request } from 'express';
import pinoHttp from 'pino-http';
import { correlationId } from './middleware/correlation-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { logger } from './lib/logger.js';

export function createApp(): Express {
  const app = express();

  app.use(correlationId);
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ correlationId: (req as Request).correlationId }),
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);

  // Domain routers will be mounted here as workstreams 2+ ship.
  // app.use('/lahtha', lahthaRouter);
  // app.use('/click',  clickRouter);

  app.use(errorHandler);
  return app;
}
