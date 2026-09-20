import { ExecutionNotConfiguredError, type ExecutionEnvironment, type ExecutionRecord, type ExecutionRepository, type OpenPositionArgs, type OpenPositionResult, type OrderExecutionPort, type PositionStatusResult, type SymbolFilters } from './execution-types.js';
import type { TradeDirection } from './types.js';

/**
 * The default execution port: refuses to place any order. This is what runs
 * whenever BINANCE_EXECUTION_ENABLED isn't explicitly set — the trading
 * service still generates and journals signals, it just never touches a real
 * exchange. Fails closed, matching the payment domain's stub/credentialed
 * pattern (ADR-0007).
 */
export class NoopExecutionPort implements OrderExecutionPort {
  readonly environment: ExecutionEnvironment = 'testnet';
  async getSymbolFilters(): Promise<SymbolFilters> {
    throw new ExecutionNotConfiguredError('BINANCE_EXECUTION_ENABLED is not set');
  }
  async getAvailableBalanceUsd(): Promise<number> {
    throw new ExecutionNotConfiguredError('BINANCE_EXECUTION_ENABLED is not set');
  }
  async openPosition(): Promise<OpenPositionResult> {
    throw new ExecutionNotConfiguredError('BINANCE_EXECUTION_ENABLED is not set');
  }
  async checkPositionStatus(): Promise<PositionStatusResult> {
    throw new ExecutionNotConfiguredError('BINANCE_EXECUTION_ENABLED is not set');
  }
}

/** In-memory fake for tests — simulates fills without any network call. */
export class FakeExecutionPort implements OrderExecutionPort {
  readonly environment: ExecutionEnvironment = 'testnet';
  private orderSeq = 0;
  public nextStatus: PositionStatusResult = { closed: false };
  public filters: SymbolFilters = { stepSize: 0.0001, tickSize: 0.01, minQty: 0.0001, minNotionalUsd: 10 };
  public availableBalanceUsd = 10_000;
  public failOpenWith: Error | null = null;

  async getSymbolFilters(_symbol: string, _direction: TradeDirection): Promise<SymbolFilters> {
    return this.filters;
  }
  async getAvailableBalanceUsd(_direction: TradeDirection): Promise<number> {
    return this.availableBalanceUsd;
  }
  async openPosition(args: OpenPositionArgs): Promise<OpenPositionResult> {
    if (this.failOpenWith) throw this.failOpenWith;
    const executedPrice = (args.takeProfit + args.stopLoss) / 2; // arbitrary deterministic fill for tests
    const executedQty = args.notionalUsd / executedPrice;
    this.orderSeq += 1;
    return {
      entryOrderId: `fake-entry-${this.orderSeq}`,
      executedQty,
      executedPrice,
      takeProfitOrderId: `fake-tp-${this.orderSeq}`,
      stopLossOrderId: `fake-sl-${this.orderSeq}`,
    };
  }
  async checkPositionStatus(_execution: ExecutionRecord): Promise<PositionStatusResult> {
    return this.nextStatus;
  }
}

export class InMemoryExecutionRepository implements ExecutionRepository {
  private readonly byId = new Map<string, ExecutionRecord>();
  async create(record: ExecutionRecord): Promise<ExecutionRecord> {
    this.byId.set(record.executionId, { ...record });
    return { ...record };
  }
  async findBySignal(signalId: string): Promise<ExecutionRecord | null> {
    for (const r of this.byId.values()) if (r.signalId === signalId) return { ...r };
    return null;
  }
  async update(record: ExecutionRecord): Promise<ExecutionRecord> {
    this.byId.set(record.executionId, { ...record });
    return { ...record };
  }
  async listRecent(limit: number): Promise<ExecutionRecord[]> {
    return [...this.byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }
  async listOpen(limit: number): Promise<ExecutionRecord[]> {
    return [...this.byId.values()].filter((r) => r.status === 'placed').slice(0, limit);
  }
}
