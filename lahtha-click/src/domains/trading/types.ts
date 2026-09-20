// Trading domain entities and ports — a semi-automated daily single-asset
// signal generator for Binance-listed pairs. This module never places live
// orders: it screens candidates, sizes a risk-managed signal, and journals
// portfolio progress toward the $5,000 → $50,000 target. Execution stays a
// human decision (see docs/adr/0011-trading-signal-agent.md).

export type TradeDirection = 'spot_long' | 'futures_long';
export type SignalOutcome = 'win' | 'loss' | 'breakeven';

// --- Market data (read-only, public Binance endpoints) ---

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  quoteVolume: number;
  bidPrice: number;
  askPrice: number;
}

export interface OrderBookDepth {
  /** Sum of bid notional within a band under the mid price. */
  bidDepthUsd: number;
  /** Sum of ask notional within a band above the mid price. */
  askDepthUsd: number;
}

export interface FuturesMetrics {
  fundingRate: number;
  openInterest: number;
  openInterestChangePercent: number;
}

export interface MarketDataPort {
  /** USDT-quoted spot symbols eligible for trading (status TRADING). */
  listUsdtSymbols(): Promise<string[]>;
  ticker24h(symbol: string): Promise<Ticker24h>;
  klines(symbol: string, interval: '1h' | '4h', limit: number): Promise<Kline[]>;
  depth(symbol: string): Promise<OrderBookDepth>;
  /** Futures data; absent when the symbol has no perpetual contract. */
  futuresMetrics(symbol: string): Promise<FuturesMetrics | null>;
}

// --- Screening ---

export interface CandidateMetrics {
  symbol: string;
  ticker: Ticker24h;
  klines1h: Kline[];
  klines4h: Kline[];
  depth: OrderBookDepth;
  futures: FuturesMetrics | null;
}

export interface FactorScoreBreakdown {
  orderFlowScore: number;
  derivativesScore: number;
  technicalScore: number;
  compositeScore: number;
}

export interface ScoredCandidate {
  symbol: string;
  metrics: CandidateMetrics;
  score: FactorScoreBreakdown;
  justification: [string, string, string];
}

// --- Signal ---

export interface Signal {
  signalId: string;
  tradeDate: string; // UTC calendar day, YYYY-MM-DD — one signal per day
  symbol: string;
  direction: TradeDirection;
  leverage: number;
  entryLow: number;
  entryHigh: number;
  takeProfit: number;
  stopLoss: number;
  riskRewardRatio: number;
  allocationPct: number;
  justification: [string, string, string];
  compositeScore: number;
  createdAt: Date;
}

export interface SignalRepository {
  create(signal: Signal): Promise<Signal>;
  findByDate(tradeDate: string): Promise<Signal | null>;
  findById(signalId: string): Promise<Signal | null>;
  listRecent(limit: number): Promise<Signal[]>;
}

// --- Portfolio ---

export interface PortfolioState {
  portfolioId: string;
  equityUsdCents: number;
  startingEquityUsdCents: number;
  targetEquityUsdCents: number;
  peakEquityUsdCents: number;
  tradeCount: number;
  wins: number;
  losses: number;
  /** Kill switch: when true, live execution is skipped even if BINANCE_EXECUTION_ENABLED is set. */
  executionPaused: boolean;
  updatedAt: Date;
}

export interface PortfolioRepository {
  get(portfolioId: string): Promise<PortfolioState | null>;
  save(state: PortfolioState): Promise<PortfolioState>;
}

export interface TradeRecord {
  tradeId: string;
  signalId: string;
  outcome: SignalOutcome;
  realizedPnlUsdCents: number;
  equityAfterUsdCents: number;
  closedAt: Date;
  closedByUserId: string;
}

export interface TradeRepository {
  create(trade: TradeRecord): Promise<TradeRecord>;
  findBySignal(signalId: string): Promise<TradeRecord | null>;
  listRecent(limit: number): Promise<TradeRecord[]>;
}

export interface Clock {
  now(): Date;
}
export interface AuditLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
}

export class NoEligibleCandidatesError extends Error {
  constructor() {
    super('No Binance USDT pair currently clears the liquidity and factor-score screen');
    this.name = 'NoEligibleCandidatesError';
  }
}
export class DrawdownHaltError extends Error {
  constructor(public readonly drawdownPct: number, public readonly maxDrawdownPct: number) {
    super(`Trading halted: drawdown ${(drawdownPct * 100).toFixed(2)}% exceeds the ${(maxDrawdownPct * 100).toFixed(2)}% cap`);
    this.name = 'DrawdownHaltError';
  }
}
export class SignalNotFoundError extends Error {
  constructor(public readonly signalId: string) {
    super(`Signal ${signalId} not found`);
    this.name = 'SignalNotFoundError';
  }
}
export class TradeAlreadyRecordedError extends Error {
  constructor(public readonly signalId: string) {
    super(`Signal ${signalId} already has a recorded outcome`);
    this.name = 'TradeAlreadyRecordedError';
  }
}
