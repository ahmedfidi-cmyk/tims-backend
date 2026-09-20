// Public entry point for the trading domain — a daily single-asset Binance
// signal generator (ADR-0011), with an opt-in live-execution seam (ADR-0012)
// that stays off unless BINANCE_EXECUTION_ENABLED is explicitly set.

import { Router } from 'express';
import { loadConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { BinanceMarketDataAdapter } from './binance-market-data.js';
import { BinanceExecutionAdapter } from './binance-execution-adapter.js';
import { InMemoryPortfolioRepository, InMemorySignalRepository, InMemoryTradeRepository, SystemClock } from './in-memory-adapters.js';
import { InMemoryExecutionRepository, NoopExecutionPort } from './in-memory-execution-adapter.js';
import { MongoPortfolioRepository, MongoSignalRepository, MongoTradeRepository } from './mongo-adapters.js';
import { MongoExecutionRepository } from './mongo-execution-adapters.js';
import { TradingService, type TradingConfig, type TradingDeps } from './trading.service.js';
import { ExecutionService, type ExecutionConfig, type ExecutionDeps } from './execution.service.js';
import { createTradingRouter } from './trading.routes.js';
import type { Authz } from '../iam/authz.js';
import type { MarketDataPort } from './types.js';
import type { OrderExecutionPort } from './execution-types.js';

export { TradingService } from './trading.service.js';
export { ExecutionService } from './execution.service.js';
export { createTradingRouter } from './trading.routes.js';
export { BinanceMarketDataAdapter } from './binance-market-data.js';
export { BinanceExecutionAdapter } from './binance-execution-adapter.js';
export * from './risk.js';
export type * from './types.js';
export type * from './execution-types.js';

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

function buildExecutionPort(): OrderExecutionPort {
  const cfg = loadConfig();
  if (!cfg.BINANCE_EXECUTION_ENABLED) return new NoopExecutionPort();
  const isTestnet = cfg.BINANCE_TRADING_ENV === 'testnet';
  return new BinanceExecutionAdapter({
    apiKey: cfg.BINANCE_API_KEY ?? '',
    apiSecret: cfg.BINANCE_API_SECRET ?? '',
    environment: cfg.BINANCE_TRADING_ENV,
    spotBaseUrl: isTestnet ? cfg.BINANCE_SPOT_TESTNET_BASE_URL : cfg.BINANCE_SPOT_BASE_URL,
    futuresBaseUrl: isTestnet ? cfg.BINANCE_FUTURES_TESTNET_BASE_URL : cfg.BINANCE_FUTURES_BASE_URL,
    requestTimeoutMs: cfg.BINANCE_REQUEST_TIMEOUT_MS,
  });
}

/**
 * Build the production execution service. Always returns a working service —
 * when BINANCE_EXECUTION_ENABLED is unset it's backed by NoopExecutionPort,
 * so executeSignal() simply no-ops (enabled: false short-circuits before the
 * port is ever called). Mount this in the router to get automatic execution;
 * omit it to run signal-generation-only. Its ledger repos are fresh Mongo
 * wrappers over the same collections createTradingService uses — safe to
 * construct independently since those repos are stateless.
 */
export function createExecutionService(): ExecutionService {
  const cfg = loadConfig();
  return new ExecutionService({
    port: buildExecutionPort(),
    executions: new MongoExecutionRepository(),
    ledger: {
      signals: new MongoSignalRepository(),
      portfolio: new MongoPortfolioRepository(),
      trades: new MongoTradeRepository(),
      clock: new SystemClock(),
      logger,
      startingEquityUsdCents: cfg.TRADING_STARTING_EQUITY_USD_CENTS,
      targetEquityUsdCents: cfg.TRADING_TARGET_EQUITY_USD_CENTS,
    },
    config: { enabled: cfg.BINANCE_EXECUTION_ENABLED, maxTradeNotionalUsd: cfg.MAX_TRADE_NOTIONAL_USD },
  });
}

/** Build an in-memory execution service (tests). */
export function createInMemoryExecutionService(overrides: Partial<ExecutionDeps> = {}): ExecutionService {
  const cfg = loadConfig();
  return new ExecutionService({
    port: overrides.port ?? new NoopExecutionPort(),
    executions: overrides.executions ?? new InMemoryExecutionRepository(),
    ledger: overrides.ledger ?? {
      signals: new InMemorySignalRepository(),
      portfolio: new InMemoryPortfolioRepository(),
      trades: new InMemoryTradeRepository(),
      clock: new SystemClock(),
      logger,
      startingEquityUsdCents: cfg.TRADING_STARTING_EQUITY_USD_CENTS,
      targetEquityUsdCents: cfg.TRADING_TARGET_EQUITY_USD_CENTS,
    },
    config: overrides.config ?? { enabled: cfg.BINANCE_EXECUTION_ENABLED, maxTradeNotionalUsd: cfg.MAX_TRADE_NOTIONAL_USD },
  });
}

export function createTradingDomainRouter(service: TradingService, authz: Authz, execution?: ExecutionService): Router {
  return createTradingRouter(service, authz, execution);
}
