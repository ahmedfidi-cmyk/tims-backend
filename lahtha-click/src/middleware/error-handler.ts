import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const correlationId = req.correlationId;
  logger.error({ err, correlationId, path: req.path, method: req.method }, 'unhandled request error');
  if (res.headersSent) return;
  res.status(500).json({
    error: 'internal_server_error',
    correlationId,
  });
}
