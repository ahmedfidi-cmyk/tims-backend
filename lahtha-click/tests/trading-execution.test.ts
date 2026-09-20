import { describe, it, expect, beforeEach } from 'vitest';
import { TradingService, type TradingConfig } from '../src/domains/trading/trading.service.js';
import { ExecutionService, type ExecutionConfig } from '../src/domains/trading/execution.service.js';
import { InMemoryPortfolioRepository, InMemorySignalRepository, InMemoryTradeRepository } from '../src/domains/trading/in-memory-adapters.js';
import { FakeExecutionPort, InMemoryExecutionRepository } from '../src/domains/trading/in-memory-execution-adapter.js';
import { ExecutionNotFoundError, InsufficientBalanceError } from '../src/domains/trading/execution-types.js';
import type { Clock, FuturesMetrics, Kline, MarketDataPort, OrderBookDepth, Ticker24h } from '../src/domains/trading/types.js';

const silentLogger = { info: () => {}, warn: () => {} };

class FixedClock implements Clock {
  constructor(private date: Date) {}
  now(): Date {
    return this.date;
  }
  advanceDays(days: number): void {
    this.date = new Date(this.date.getTime() + days * 86_400_000);
  }
}

function makeKlines(closes: number[]): Kline[] {
  return closes.map((close, i) => ({
    openTime: i * 3_600_000,
    open: closes[i - 1] ?? close,
    high: close * 1.001,
    low: close * 0.999,
    close,
    volume: 1000,
    closeTime: i * 3_600_000 + 3_599_999,
  }));
}
function goodTrendCloses(base = 100, bars = 40): number[] {
  const closes: number[] = [base];
  for (let i = 1; i < bars; i += 1) closes.push(closes.at(-1)! + (i % 3 === 0 ? -0.1 : 0.3));
  return closes;
}

class FakeMarketData implements MarketDataPort {
  constructor(private readonly symbols: Record<string, { ticker: Ticker24h; futures?: FuturesMetrics | null }>) {}
  async listUsdtSymbols(): Promise<string[]> {
    return Object.keys(this.symbols);
  }
  async ticker24h(symbol: string): Promise<Ticker24h> {
    const entry = this.symbols[symbol];
    if (!entry) throw new Error(`unknown symbol ${symbol}`);
    return entry.ticker;
  }
  async klines(): Promise<Kline[]> {
    return makeKlines(goodTrendCloses());
  }
  async depth(): Promise<OrderBookDepth> {
    return { bidDepthUsd: 900_000, askDepthUsd: 100_000 };
  }
  async futuresMetrics(symbol: string): Promise<FuturesMetrics | null> {
    return this.symbols[symbol]?.futures ?? null;
  }
}

function ticker(symbol: string, overrides: Partial<Ticker24h> = {}): Ticker24h {
  return { symbol, lastPrice: 100, priceChangePercent: 1, quoteVolume: 50_000_000, bidPrice: 99.95, askPrice: 100.05, ...overrides };
}

function harness(opts: { enabled?: boolean; maxTradeNotionalUsd?: number } = {}) {
  const clock = new FixedClock(new Date('2026-09-18T00:00:00Z'));
  const signals = new InMemorySignalRepository();
  const portfolio = new InMemoryPortfolioRepository();
  const trades = new InMemoryTradeRepository();
  const tradingConfig: TradingConfig = { startingEquityUsdCents: 500_000, targetEquityUsdCents: 5_000_000, candidatePoolSize: 30 };
  const trading = new TradingService({
    marketData: new FakeMarketData({ BTCUSDT: { ticker: ticker('BTCUSDT') } }),
    signals,
    portfolio,
    trades,
    clock,
    logger: silentLogger,
    config: tradingConfig,
  });

  const port = new FakeExecutionPort();
  const executions = new InMemoryExecutionRepository();
  const executionConfig: ExecutionConfig = { enabled: opts.enabled ?? true, maxTradeNotionalUsd: opts.maxTradeNotionalUsd ?? 100_000 };
  const execution = new ExecutionService({
    port,
    executions,
    ledger: { signals, portfolio, trades, clock, logger: silentLogger, startingEquityUsdCents: 500_000, targetEquityUsdCents: 5_000_000 },
    config: executionConfig,
  });

  return { trading, execution, port, clock };
}

describe('ExecutionService.executeSignal', () => {
  it('no-ops when execution is disabled', async () => {
    const { trading, execution } = harness({ enabled: false });
    const signal = await trading.generateDailySignal();
    const result = await execution.executeSignal(signal);
    expect(result).toBeNull();
  });

  it('places an order and journals an ExecutionRecord when enabled', async () => {
    const { trading, execution } = harness();
    const signal = await trading.generateDailySignal();
    const result = await execution.executeSignal(signal);
    expect(result?.status).toBe('placed');
    expect(result?.entryOrderId).toBeTruthy();
    expect(result?.takeProfitOrderId).toBeTruthy();
    expect(result?.stopLossOrderId).toBeTruthy();
  });

  it('caps the notional at maxTradeNotionalUsd regardless of the Kelly-sized allocationPct', async () => {
    const { trading, execution } = harness({ maxTradeNotionalUsd: 50 });
    const signal = await trading.generateDailySignal();
    expect(signal.allocationPct * 5000).toBeGreaterThan(50); // sanity: Kelly sizing would ask for more than the cap
    const result = await execution.executeSignal(signal);
    expect(result?.notionalUsd).toBe(50);
  });

  it('is idempotent — a second call for the same signal does not place a second order', async () => {
    const { trading, execution, port } = harness();
    const signal = await trading.generateDailySignal();
    const first = await execution.executeSignal(signal);
    const second = await execution.executeSignal(signal);
    expect(second?.executionId).toBe(first?.executionId);
  });

  it('records a failed ExecutionRecord (not a thrown error) when the venue rejects the order', async () => {
    const { trading, execution, port } = harness();
    port.failOpenWith = new InsufficientBalanceError(10, 500);
    const signal = await trading.generateDailySignal();
    const result = await execution.executeSignal(signal);
    expect(result?.status).toBe('failed');
    expect(result?.errorMessage).toContain('Insufficient balance');
  });

  it('skips execution when the portfolio kill switch is paused', async () => {
    const { trading, execution } = harness();
    await execution.pauseExecution();
    const signal = await trading.generateDailySignal();
    const result = await execution.executeSignal(signal);
    expect(result).toBeNull();
  });

  it('resumes execution after resumeExecution', async () => {
    const { trading, execution } = harness();
    await execution.pauseExecution();
    await execution.resumeExecution();
    const signal = await trading.generateDailySignal();
    const result = await execution.executeSignal(signal);
    expect(result?.status).toBe('placed');
  });
});

describe('ExecutionService.syncExecution', () => {
  it('leaves the record open while the position has not closed', async () => {
    const { trading, execution, port } = harness();
    const signal = await trading.generateDailySignal();
    await execution.executeSignal(signal);
    port.nextStatus = { closed: false };
    const synced = await execution.syncExecution(signal.signalId);
    expect(synced.status).toBe('placed');
  });

  it('journals a take-profit close as a win and increases portfolio equity', async () => {
    const { trading, execution, port } = harness();
    const signal = await trading.generateDailySignal();
    const placed = await execution.executeSignal(signal);
    port.nextStatus = { closed: true, outcome: 'take_profit', exitPrice: placed!.executedPrice * 1.05 };

    const before = await trading.getPortfolio();
    const synced = await execution.syncExecution(signal.signalId);
    const after = await trading.getPortfolio();

    expect(synced.status).toBe('closed');
    expect(synced.outcome).toBe('take_profit');
    expect(after.equityUsdCents).toBeGreaterThan(before.equityUsdCents);
    expect(after.wins).toBe(1);
  });

  it('journals a stop-loss close as a loss and decreases portfolio equity', async () => {
    const { trading, execution, port } = harness();
    const signal = await trading.generateDailySignal();
    const placed = await execution.executeSignal(signal);
    port.nextStatus = { closed: true, outcome: 'stop_loss', exitPrice: placed!.executedPrice * 0.98 };

    const before = await trading.getPortfolio();
    const synced = await execution.syncExecution(signal.signalId);
    const after = await trading.getPortfolio();

    expect(synced.outcome).toBe('stop_loss');
    expect(after.equityUsdCents).toBeLessThan(before.equityUsdCents);
    expect(after.losses).toBe(1);
  });

  it('is idempotent — syncing an already-closed execution does not double-journal', async () => {
    const { trading, execution, port } = harness();
    const signal = await trading.generateDailySignal();
    const placed = await execution.executeSignal(signal);
    port.nextStatus = { closed: true, outcome: 'take_profit', exitPrice: placed!.executedPrice * 1.05 };
    await execution.syncExecution(signal.signalId);
    const after1 = await trading.getPortfolio();
    const resynced = await execution.syncExecution(signal.signalId);
    const after2 = await trading.getPortfolio();
    expect(resynced.status).toBe('closed');
    expect(after2.equityUsdCents).toBe(after1.equityUsdCents);
  });

  it('throws ExecutionNotFoundError for a signal with no execution record', async () => {
    const { execution } = harness();
    await expect(execution.syncExecution('nope')).rejects.toBeInstanceOf(ExecutionNotFoundError);
  });
});
