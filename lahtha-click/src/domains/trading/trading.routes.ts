// HTTP controllers for the trading domain. Every route requires a session with
// the relevant trading permission — signals and portfolio state are never public.

import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { recordTradeSchema } from './schemas.js';
import { TradingService } from './trading.service.js';
import { DrawdownHaltError, NoEligibleCandidatesError, SignalNotFoundError, TradeAlreadyRecordedError } from './types.js';
import type { Authz } from '../iam/authz.js';

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
  if (err instanceof NoEligibleCandidatesError) return void res.status(204).end();
  if (err instanceof DrawdownHaltError) {
    return void res
      .status(423)
      .json({ error: 'trading_halted_drawdown', drawdownPct: err.drawdownPct, maxDrawdownPct: err.maxDrawdownPct, correlationId });
  }
  if (err instanceof SignalNotFoundError) return void res.status(404).json({ error: 'signal_not_found', correlationId });
  if (err instanceof TradeAlreadyRecordedError) return void res.status(409).json({ error: 'trade_already_recorded', correlationId });
  next(err);
}

export function createTradingRouter(service: TradingService, authz: Authz): Router {
  const router = Router();

  // Today's daily single-asset signal (generates it on first call of the UTC day).
  router.get('/trading/signal/today', authz.requirePermission('trading.signal.view'), asyncHandler(async (_req, res) => {
    const signal = await service.generateDailySignal();
    res.json(signal);
  }));

  router.get('/trading/signals', authz.requirePermission('trading.signal.view'), asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const items = await service.listRecentSignals(Number.isFinite(limit) ? limit : 20);
    res.json({ items, total: items.length });
  }));

  router.get('/trading/portfolio', authz.requirePermission('trading.signal.view'), asyncHandler(async (_req, res) => {
    res.json(await service.getPortfolio());
  }));

  router.get('/trading/trades', authz.requirePermission('trading.signal.view'), asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const items = await service.listRecentTrades(Number.isFinite(limit) ? limit : 20);
    res.json({ items, total: items.length });
  }));

  // Journal a signal's real-world outcome (executed manually) and update equity.
  router.post(
    '/trading/signals/:signalId/trades',
    authz.requirePermission('trading.portfolio.manage'),
    asyncHandler(async (req, res) => {
      const input = recordTradeSchema.parse(req.body);
      const result = await service.recordTradeOutcome(param(req, 'signalId'), input.outcome, input.realizedPnlUsdCents, req.principalUserId!);
      res.status(201).json(result);
    }),
  );

  return router;
}
