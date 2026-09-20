// Shared portfolio equity/journal logic — used by both TradingService (a
// human reports a trade outcome) and ExecutionService (a live position
// closes on Binance and reports itself). Keeping this in one place means
// both paths update equity/peak/win-loss identically instead of drifting.

import { randomUUID } from 'node:crypto';
import {
  SignalNotFoundError,
  TradeAlreadyRecordedError,
  type AuditLogger,
  type Clock,
  type PortfolioRepository,
  type PortfolioState,
  type SignalOutcome,
  type SignalRepository,
  type TradeRecord,
  type TradeRepository,
} from './types.js';

export const PORTFOLIO_ID = 'main';

export interface PortfolioLedgerDeps {
  signals: SignalRepository;
  portfolio: PortfolioRepository;
  trades: TradeRepository;
  clock: Clock;
  logger: AuditLogger;
  startingEquityUsdCents: number;
  targetEquityUsdCents: number;
}

export async function ensurePortfolio(deps: PortfolioLedgerDeps): Promise<PortfolioState> {
  const existing = await deps.portfolio.get(PORTFOLIO_ID);
  if (existing) return existing;
  const now = deps.clock.now();
  const fresh: PortfolioState = {
    portfolioId: PORTFOLIO_ID,
    equityUsdCents: deps.startingEquityUsdCents,
    startingEquityUsdCents: deps.startingEquityUsdCents,
    targetEquityUsdCents: deps.targetEquityUsdCents,
    peakEquityUsdCents: deps.startingEquityUsdCents,
    tradeCount: 0,
    wins: 0,
    losses: 0,
    executionPaused: false,
    updatedAt: now,
  };
  return deps.portfolio.save(fresh);
}

export async function applyTradeOutcome(
  deps: PortfolioLedgerDeps,
  signalId: string,
  outcome: SignalOutcome,
  realizedPnlUsdCents: number,
  byUserId: string,
): Promise<{ trade: TradeRecord; portfolio: PortfolioState }> {
  const signal = await deps.signals.findById(signalId);
  if (!signal) throw new SignalNotFoundError(signalId);

  const already = await deps.trades.findBySignal(signalId);
  if (already) throw new TradeAlreadyRecordedError(signalId);

  const portfolio = await ensurePortfolio(deps);
  const equityAfter = portfolio.equityUsdCents + realizedPnlUsdCents;
  const updated: PortfolioState = {
    ...portfolio,
    equityUsdCents: equityAfter,
    peakEquityUsdCents: Math.max(portfolio.peakEquityUsdCents, equityAfter),
    tradeCount: portfolio.tradeCount + 1,
    wins: portfolio.wins + (outcome === 'win' ? 1 : 0),
    losses: portfolio.losses + (outcome === 'loss' ? 1 : 0),
    updatedAt: deps.clock.now(),
  };
  await deps.portfolio.save(updated);

  const trade: TradeRecord = {
    tradeId: randomUUID(),
    signalId,
    outcome,
    realizedPnlUsdCents,
    equityAfterUsdCents: equityAfter,
    closedAt: deps.clock.now(),
    closedByUserId: byUserId,
  };
  const savedTrade = await deps.trades.create(trade);
  deps.logger.info(
    { event: 'TRADING_OUTCOME_RECORDED', signalId, outcome, realizedPnlUsdCents, equityAfterUsdCents: equityAfter },
    'trade outcome recorded',
  );
  return { trade: savedTrade, portfolio: updated };
}
