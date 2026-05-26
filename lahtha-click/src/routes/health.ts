import { Router, type Request, type Response } from 'express';
import { isDatabaseConnected } from '../lib/db.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/ready', (_req: Request, res: Response) => {
  if (!isDatabaseConnected()) {
    res.status(503).json({ status: 'not_ready', db: 'disconnected' });
    return;
  }
  res.json({ status: 'ready', db: 'connected' });
});
