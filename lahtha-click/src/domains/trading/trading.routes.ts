// HTTP controllers for the trading domain. Every route requires a session with
// the relevant trading permission — signals and portfolio state are never public.

import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { recordTradeSchema } from './schemas.js';
import { TradingService } from './trading.service.js';
import { ExecutionService } from './execution.service.js';
import { ExecutionNotConfiguredError, ExecutionNotFoundError, InsufficientBalanceError } from './execution-types.js';
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
  if (err instanceof ExecutionNotFoundError) return void res.status(404).json({ error: 'execution_not_found', correlationId });
  if (err instanceof ExecutionNotConfiguredError) return void res.status(409).json({ error: 'execution_not_configured', message: err.message, correlationId });
  if (err instanceof InsufficientBalanceError) {
    return void res
      .status(422)
      .json({ error: 'insufficient_balance', availableUsd: err.availableUsd, requiredUsd: err.requiredUsd, correlationId });
  }
  next(err);
}

/**
 * @param execution Optional — when provided, generating today's signal also
 *   attempts live execution (fully automatic, per ADR-0012). Omit to run the
 *   trading domain as signal-generation-only.
 */
export function createTradingRouter(service: TradingService, authz: Authz, execution?: ExecutionService): Router {
  const router = Router();

  // Today's daily single-asset signal (generates it on first call of the UTC day).
  // When execution is wired in, this is also the trigger that places the live order.
  router.get('/trading/signal/today', authz.requirePermission('trading.signal.view'), asyncHandler(async (_req, res) => {
    const signal = await service.generateDailySignal();
    const executionRecord = execution ? await execution.executeSignal(signal) : null;
    res.json({ ...signal, execution: executionRecord });
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

  // Journal a signal's real-world outcome (executed manually, or reconciled via
  // POST .../execution/sync below) and update equity.
  router.post(
    '/trading/signals/:signalId/trades',
    authz.requirePermission('trading.portfolio.manage'),
    asyncHandler(async (req, res) => {
      const input = recordTradeSchema.parse(req.body);
      const result = await service.recordTradeOutcome(param(req, 'signalId'), input.outcome, input.realizedPnlUsdCents, req.principalUserId!);
      res.status(201).json(result);
    }),
  );

  // --- Live execution (ADR-0012) — only meaningful when BINANCE_EXECUTION_ENABLED. ---

  router.get('/trading/executions', authz.requirePermission('trading.signal.view'), asyncHandler(async (req, res) => {
    if (!execution) return void res.json({ items: [], total: 0 });
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const items = await execution.listRecentExecutions(Number.isFinite(limit) ? limit : 20);
    res.json({ items, total: items.length });
  }));

  // No scheduler ships in this repo — call this periodically (external cron)
  // to reconcile a placed position once its TP/SL has filled on Binance.
  router.post(
    '/trading/signals/:signalId/execution/sync',
    authz.requirePermission('trading.portfolio.manage'),
    asyncHandler(async (req, res) => {
      if (!execution) return void res.status(409).json({ error: 'execution_not_configured', correlationId: req.correlationId });
      res.json(await execution.syncExecution(param(req, 'signalId')));
    }),
  );

  // Kill switch — stops new live orders without a redeploy. Safe to call whether
  // or not execution is configured.
  router.post('/trading/execution/pause', authz.requirePermission('trading.portfolio.manage'), asyncHandler(async (_req, res) => {
    if (execution) await execution.pauseExecution();
    res.json(await service.getPortfolio());
  }));
  router.post('/trading/execution/resume', authz.requirePermission('trading.portfolio.manage'), asyncHandler(async (_req, res) => {
    if (execution) await execution.resumeExecution();
    res.json(await service.getPortfolio());
  }));

  return router;
}
