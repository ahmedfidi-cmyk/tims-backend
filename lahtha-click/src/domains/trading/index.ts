// Public entry point for the trading domain — a semi-automated daily
// single-asset Binance signal generator. See docs/adr/0011-trading-signal-agent.md for the
// strategy mandate and scope (signals only; no live order execution).

import { Router } from 'express';
import { loadConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { BinanceMarketDataAdapter } from './binance-market-data.js';
import { InMemoryPortfolioRepository, InMemorySignalRepository, InMemoryTradeRepository, SystemClock } from './in-memory-adapters.js';
import { MongoPortfolioRepository, MongoSignalRepository, MongoTradeRepository } from './mongo-adapters.js';
import { TradingService, type TradingConfig, type TradingDeps } from './trading.service.js';
import { createTradingRouter } from './trading.routes.js';
import type { Authz } from '../iam/authz.js';
import type { MarketDataPort } from './types.js';

export { TradingService } from './trading.service.js';
export { createTradingRouter } from './trading.routes.js';
export { BinanceMarketDataAdapter } from './binance-market-data.js';
export * from './risk.js';
export type * from './types.js';

function buildConfig(): TradingConfig {
  const cfg = loadConfig();
  return {
    startingEquityUsdCents: cfg.TRADING_STARTING_EQUITY_USD_CENTS,
    targetEquityUsdCents: cfg.TRADING_TARGET_EQUITY_USD_CENTS,
    candidatePoolSize: cfg.TRADING_CANDIDATE_POOL_SIZE,
  };
}

function buildMarketData(): MarketDataPort {
  const cfg = loadConfig();
  return new BinanceMarketDataAdapter({
    spotBaseUrl: cfg.BINANCE_SPOT_BASE_URL,
    futuresBaseUrl: cfg.BINANCE_FUTURES_BASE_URL,
    requestTimeoutMs: cfg.BINANCE_REQUEST_TIMEOUT_MS,
  });
}

/** Build the production trading service (live Binance market data + Mongo journal). */
export function createTradingService(): TradingService {
  return new TradingService({
    marketData: buildMarketData(),
    signals: new MongoSignalRepository(),
    portfolio: new MongoPortfolioRepository(),
    trades: new MongoTradeRepository(),
    clock: new SystemClock(),
    logger,
    config: buildConfig(),
  });
}

/** Build an in-memory trading service (tests), optionally overriding market data. */
export function createInMemoryTradingService(overrides: Partial<TradingDeps> = {}): TradingService {
  return new TradingService({
    marketData: overrides.marketData ?? buildMarketData(),
    signals: overrides.signals ?? new InMemorySignalRepository(),
    portfolio: overrides.portfolio ?? new InMemoryPortfolioRepository(),
    trades: overrides.trades ?? new InMemoryTradeRepository(),
    clock: overrides.clock ?? new SystemClock(),
    logger: overrides.logger ?? logger,
    config: overrides.config ?? buildConfig(),
  });
}

export function createTradingDomainRouter(service: TradingService, authz: Authz): Router {
  return createTradingRouter(service, authz);
}
