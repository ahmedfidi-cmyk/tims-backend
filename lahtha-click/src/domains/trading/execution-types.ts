// Live order execution — entities and ports. Placing/monitoring real Binance
// orders is a materially different risk class from the read-only market-data
// port in types.ts, so it gets its own seam: every live call goes through
// OrderExecutionPort, and the wiring in index.ts defaults to a no-op adapter
// unless BINANCE_EXECUTION_ENABLED is explicitly set. See ADR-0012.

import type { TradeDirection } from './types.js';

export type ExecutionEnvironment = 'testnet' | 'mainnet';
export type ExecutionStatus = 'placed' | 'failed' | 'closed';
export type ExecutionOutcome = 'take_profit' | 'stop_loss';

export interface SymbolFilters {
  stepSize: number;
  tickSize: number;
  minQty: number;
  minNotionalUsd: number;
}

export interface OpenPositionArgs {
  symbol: string;
  direction: TradeDirection;
  notionalUsd: number;
  takeProfit: number;
  stopLoss: number;
}

export interface OpenPositionResult {
  entryOrderId: string;
  executedQty: number;
  executedPrice: number;
  takeProfitOrderId: string;
  stopLossOrderId: string;
}

export interface PositionStatusResult {
  closed: boolean;
  outcome?: ExecutionOutcome;
  exitPrice?: number;
}

export class ExecutionNotConfiguredError extends Error {
  constructor(reason: string) {
    super(`Binance execution is not safely configured: ${reason}`);
    this.name = 'ExecutionNotConfiguredError';
  }
}
export class InsufficientBalanceError extends Error {
  constructor(public readonly availableUsd: number, public readonly requiredUsd: number) {
    super(`Insufficient balance: available $${availableUsd.toFixed(2)}, required $${requiredUsd.toFixed(2)}`);
    this.name = 'InsufficientBalanceError';
  }
}
export class ExecutionNotFoundError extends Error {
  constructor(public readonly signalId: string) {
    super(`No execution recorded for signal ${signalId}`);
    this.name = 'ExecutionNotFoundError';
  }
}

/** A live trading venue. Every method call risks real capital on 'mainnet'. */
export interface OrderExecutionPort {
  readonly environment: ExecutionEnvironment;
  getSymbolFilters(symbol: string, direction: TradeDirection): Promise<SymbolFilters>;
  /** Free quote-asset (USDT) balance available for a new position. */
  getAvailableBalanceUsd(direction: TradeDirection): Promise<number>;
  /** Opens the position at market and immediately attaches TP/SL (OCO on spot, reduce-only stop/TP on futures). */
  openPosition(args: OpenPositionArgs): Promise<OpenPositionResult>;
  /** Polls whether the attached TP/SL has closed the position yet. */
  checkPositionStatus(execution: ExecutionRecord): Promise<PositionStatusResult>;
}

export interface ExecutionRecord {
  executionId: string;
  signalId: string;
  symbol: string;
  direction: TradeDirection;
  environment: ExecutionEnvironment;
  status: ExecutionStatus;
  notionalUsd: number;
  executedQty: number;
  executedPrice: number;
  entryOrderId: string;
  takeProfitOrderId: string | null;
  stopLossOrderId: string | null;
  outcome: ExecutionOutcome | null;
  exitPrice: number | null;
  errorMessage: string | null;
  createdAt: Date;
  closedAt: Date | null;
}

export interface ExecutionRepository {
  create(record: ExecutionRecord): Promise<ExecutionRecord>;
  findBySignal(signalId: string): Promise<ExecutionRecord | null>;
  update(record: ExecutionRecord): Promise<ExecutionRecord>;
  listRecent(limit: number): Promise<ExecutionRecord[]>;
  listOpen(limit: number): Promise<ExecutionRecord[]>;
}
