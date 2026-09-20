// Drives live order placement and settlement reconciliation for a generated
// signal. Kept separate from TradingService (no import in either direction)
// so signal generation always works standalone; the router wires the two
// together for the one HTTP flow that needs both (see docs/adr/0012).

import { randomUUID } from 'node:crypto';
import { applyTradeOutcome, ensurePortfolio, type PortfolioLedgerDeps } from './portfolio-ledger.js';
import { ExecutionNotFoundError, type ExecutionRecord, type ExecutionRepository, type OrderExecutionPort } from './execution-types.js';
import type { Signal } from './types.js';

export interface ExecutionConfig {
  /** Fails closed: no order is ever placed unless this is explicitly true. */
  enabled: boolean;
  /** Hard per-trade notional cap in USD, independent of the Kelly-sized allocationPct. */
  maxTradeNotionalUsd: number;
}

export interface ExecutionDeps {
  port: OrderExecutionPort;
  executions: ExecutionRepository;
  ledger: PortfolioLedgerDeps;
  config: ExecutionConfig;
}

export class ExecutionService {
  constructor(private readonly deps: ExecutionDeps) {}

  /**
   * Places the live entry + attached TP/SL for a freshly generated signal.
   * No-ops (returns null) when execution is disabled, paused, or already
   * placed for this signal — safe to call on every signal-generation request.
   */
  async executeSignal(signal: Signal): Promise<ExecutionRecord | null> {
    if (!this.deps.config.enabled) return null;

    const portfolio = await ensurePortfolio(this.deps.ledger);
    if (portfolio.executionPaused) {
      this.deps.ledger.logger.warn({ event: 'TRADING_EXECUTION_PAUSED', signalId: signal.signalId }, 'execution paused, signal not placed');
      return null;
    }

    const already = await this.deps.executions.findBySignal(signal.signalId);
    if (already) return already;

    const equityUsd = portfolio.equityUsdCents / 100;
    const requestedNotional = Math.min(equityUsd * signal.allocationPct, this.deps.config.maxTradeNotionalUsd);
    const now = this.deps.ledger.clock.now();

    try {
      const result = await this.deps.port.openPosition({
        symbol: signal.symbol,
        direction: signal.direction,
        notionalUsd: requestedNotional,
        takeProfit: signal.takeProfit,
        stopLoss: signal.stopLoss,
      });
      const record: ExecutionRecord = {
        executionId: randomUUID(),
        signalId: signal.signalId,
        symbol: signal.symbol,
        direction: signal.direction,
        environment: this.deps.port.environment,
        status: 'placed',
        notionalUsd: requestedNotional,
        executedQty: result.executedQty,
        executedPrice: result.executedPrice,
        entryOrderId: result.entryOrderId,
        takeProfitOrderId: result.takeProfitOrderId,
        stopLossOrderId: result.stopLossOrderId,
        outcome: null,
        exitPrice: null,
        errorMessage: null,
        createdAt: now,
        closedAt: null,
      };
      const saved = await this.deps.executions.create(record);
      this.deps.ledger.logger.info(
        { event: 'TRADING_EXECUTION_PLACED', signalId: signal.signalId, symbol: signal.symbol, notionalUsd: requestedNotional, environment: saved.environment },
        'live position opened',
      );
      return saved;
    } catch (err) {
      const record: ExecutionRecord = {
        executionId: randomUUID(),
        signalId: signal.signalId,
        symbol: signal.symbol,
        direction: signal.direction,
        environment: this.deps.port.environment,
        status: 'failed',
        notionalUsd: requestedNotional,
        executedQty: 0,
        executedPrice: 0,
        entryOrderId: '',
        takeProfitOrderId: null,
        stopLossOrderId: null,
        outcome: null,
        exitPrice: null,
        errorMessage: err instanceof Error ? err.message : String(err),
        createdAt: now,
        closedAt: null,
      };
      const saved = await this.deps.executions.create(record);
      this.deps.ledger.logger.warn(
        { event: 'TRADING_EXECUTION_FAILED', signalId: signal.signalId, error: record.errorMessage },
        'live position failed to open — requires human review',
      );
      return saved;
    }
  }

  /**
   * Polls whether a placed position's TP/SL has filled; if so, journals the
   * realized outcome through the same portfolio ledger a manually-reported
   * trade uses. No scheduler ships in this repo — call this periodically
   * (cron hitting POST /trading/signals/:id/execution/sync) per ADR-0012.
   */
  async syncExecution(signalId: string): Promise<ExecutionRecord> {
    const execution = await this.deps.executions.findBySignal(signalId);
    if (!execution) throw new ExecutionNotFoundError(signalId);
    if (execution.status !== 'placed') return execution;

    const status = await this.deps.port.checkPositionStatus(execution);
    if (!status.closed) return execution;

    const exitPrice = status.exitPrice ?? execution.executedPrice;
    const realizedPnlUsd = (exitPrice - execution.executedPrice) * execution.executedQty;
    const realizedPnlUsdCents = Math.round(realizedPnlUsd * 100);

    const closed: ExecutionRecord = {
      ...execution,
      status: 'closed',
      outcome: status.outcome ?? null,
      exitPrice,
      closedAt: this.deps.ledger.clock.now(),
    };
    await this.deps.executions.update(closed);

    await applyTradeOutcome(
      this.deps.ledger,
      signalId,
      status.outcome === 'take_profit' ? 'win' : 'loss',
      realizedPnlUsdCents,
      'binance-execution-sync',
    );

    this.deps.ledger.logger.info(
      { event: 'TRADING_EXECUTION_CLOSED', signalId, outcome: status.outcome, realizedPnlUsdCents },
      'live position closed and journaled',
    );
    return closed;
  }

  async listRecentExecutions(limit = 20): Promise<ExecutionRecord[]> {
    return this.deps.executions.listRecent(limit);
  }

  /** Kill switch — stops new live orders without touching config or redeploying. */
  async pauseExecution(): Promise<void> {
    const portfolio = await ensurePortfolio(this.deps.ledger);
    await this.deps.ledger.portfolio.save({ ...portfolio, executionPaused: true, updatedAt: this.deps.ledger.clock.now() });
  }
  async resumeExecution(): Promise<void> {
    const portfolio = await ensurePortfolio(this.deps.ledger);
    await this.deps.ledger.portfolio.save({ ...portfolio, executionPaused: false, updatedAt: this.deps.ledger.clock.now() });
  }
}
