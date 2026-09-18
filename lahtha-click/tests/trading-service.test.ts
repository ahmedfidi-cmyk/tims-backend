import { describe, it, expect, beforeEach } from 'vitest';
import { TradingService, type TradingConfig } from '../src/domains/trading/trading.service.js';
import { InMemoryPortfolioRepository, InMemorySignalRepository, InMemoryTradeRepository } from '../src/domains/trading/in-memory-adapters.js';
import { DrawdownHaltError, NoEligibleCandidatesError, SignalNotFoundError, TradeAlreadyRecordedError } from '../src/domains/trading/types.js';
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

/** A fake Binance market-data port over a fixed symbol → ticker map (no network). */
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
  return {
    symbol,
    lastPrice: 100,
    priceChangePercent: 1,
    quoteVolume: 50_000_000,
    bidPrice: 99.95,
    askPrice: 100.05,
    ...overrides,
  };
}

function harness(marketData?: MarketDataPort, clock = new FixedClock(new Date('2026-09-18T00:00:00Z'))) {
  const config: TradingConfig = { startingEquityUsdCents: 500_000, targetEquityUsdCents: 5_000_000, candidatePoolSize: 30 };
  const service = new TradingService({
    marketData: marketData ?? new FakeMarketData({ BTCUSDT: { ticker: ticker('BTCUSDT') } }),
    signals: new InMemorySignalRepository(),
    portfolio: new InMemoryPortfolioRepository(),
    trades: new InMemoryTradeRepository(),
    clock,
    logger: silentLogger,
    config,
  });
  return { service, clock };
}

describe('TradingService.generateDailySignal', () => {
  it('generates exactly one signal for a candidate that clears the screen', async () => {
    const { service } = harness();
    const signal = await service.generateDailySignal();
    expect(signal.symbol).toBe('BTCUSDT');
    expect(signal.direction).toBe('spot_long');
    expect(signal.leverage).toBe(1);
    expect(signal.takeProfit).toBeCloseTo(signal.entryHigh * 1.05, 0);
    expect(signal.allocationPct).toBeGreaterThan(0);
  });

  it('is idempotent — a second call the same UTC day returns the same signal', async () => {
    const { service } = harness();
    const first = await service.generateDailySignal();
    const second = await service.generateDailySignal();
    expect(second.signalId).toBe(first.signalId);
    const all = await service.listRecentSignals(10);
    expect(all).toHaveLength(1);
  });

  it('generates a new signal on a new UTC day', async () => {
    const { service, clock } = harness();
    const first = await service.generateDailySignal();
    clock.advanceDays(1);
    const second = await service.generateDailySignal();
    expect(second.signalId).not.toBe(first.signalId);
    expect(second.tradeDate).not.toBe(first.tradeDate);
  });

  it('throws NoEligibleCandidatesError when nothing clears the liquidity gate', async () => {
    const marketData = new FakeMarketData({ BTCUSDT: { ticker: ticker('BTCUSDT', { quoteVolume: 1000 }) } });
    const { service } = harness(marketData);
    await expect(service.generateDailySignal()).rejects.toBeInstanceOf(NoEligibleCandidatesError);
  });

  it('caps futures leverage at 3x when derivatives confirm the move', async () => {
    const marketData = new FakeMarketData({
      BTCUSDT: {
        ticker: ticker('BTCUSDT', { priceChangePercent: 5 }),
        futures: { fundingRate: 0.0002, openInterest: 100, openInterestChangePercent: 10 },
      },
    });
    const { service } = harness(marketData);
    const signal = await service.generateDailySignal();
    expect(signal.direction).toBe('futures_long');
    expect(signal.leverage).toBeLessThanOrEqual(3);
  });

  it('halts with DrawdownHaltError once portfolio drawdown reaches 5%', async () => {
    const { service, clock } = harness();
    const first = await service.generateDailySignal();
    // Simulate a losing trade that draws equity down >5% from the $5,000 peak.
    await service.recordTradeOutcome(first.signalId, 'loss', -30_000, 'admin-1');
    clock.advanceDays(1); // idempotency would otherwise mask the halt within the same UTC day
    await expect(service.generateDailySignal()).rejects.toBeInstanceOf(DrawdownHaltError);
  });
});

describe('TradingService.recordTradeOutcome', () => {
  it('updates equity, peak, and win/loss counters', async () => {
    const { service } = harness();
    const signal = await service.generateDailySignal();
    const { portfolio } = await service.recordTradeOutcome(signal.signalId, 'win', 25_000, 'admin-1');
    expect(portfolio.equityUsdCents).toBe(525_000);
    expect(portfolio.peakEquityUsdCents).toBe(525_000);
    expect(portfolio.wins).toBe(1);
    expect(portfolio.tradeCount).toBe(1);
  });

  it('rejects recording an outcome twice for the same signal', async () => {
    const { service } = harness();
    const signal = await service.generateDailySignal();
    await service.recordTradeOutcome(signal.signalId, 'win', 25_000, 'admin-1');
    await expect(service.recordTradeOutcome(signal.signalId, 'win', 25_000, 'admin-1')).rejects.toBeInstanceOf(TradeAlreadyRecordedError);
  });

  it('rejects recording an outcome for an unknown signal', async () => {
    const { service } = harness();
    await expect(service.recordTradeOutcome('nope', 'win', 1000, 'admin-1')).rejects.toBeInstanceOf(SignalNotFoundError);
  });
});

describe('TradingService.getPortfolio', () => {
  it('initializes at the configured starting equity and reports progress toward target', async () => {
    const { service } = harness();
    const view = await service.getPortfolio();
    expect(view.equityUsdCents).toBe(500_000);
    expect(view.targetEquityUsdCents).toBe(5_000_000);
    expect(view.progressPct).toBe(0);
    expect(view.drawdownPct).toBe(0);
  });
});
