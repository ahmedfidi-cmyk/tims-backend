// Orchestrates the daily single-asset signal: screen → score → size → journal.
// Never places a live order itself — see ExecutionService (execution.service.ts)
// for the opt-in live-execution seam, gated by BINANCE_EXECUTION_ENABLED
// (docs/adr/0012-live-binance-execution.md). Signal generation always works
// standalone as a decision-support tool (docs/adr/0011-trading-signal-agent.md).

import { randomUUID } from 'node:crypto';
import { allocationPctFromKelly, isDrawdownHalted, leverageForDirection, rewardRiskRatio, stopLossPctFromVolatility, winProbabilityFromScore } from './risk.js';
import { bollingerBands } from './indicators.js';
import { screenCandidates, selectTopCandidate } from './screening.js';
import { applyTradeOutcome, ensurePortfolio, type PortfolioLedgerDeps } from './portfolio-ledger.js';
import {
  DrawdownHaltError,
  NoEligibleCandidatesError,
  type AuditLogger,
  type CandidateMetrics,
  type Clock,
  type MarketDataPort,
  type PortfolioRepository,
  type PortfolioState,
  type Signal,
  type SignalOutcome,
  type SignalRepository,
  type TradeRecord,
  type TradeRepository,
} from './types.js';

export interface TradingConfig {
  startingEquityUsdCents: number;
  targetEquityUsdCents: number;
  /** How many top-by-volume symbols to pull full market data for (bounds API calls). */
  candidatePoolSize: number;
}

export interface TradingDeps {
  marketData: MarketDataPort;
  signals: SignalRepository;
  portfolio: PortfolioRepository;
  trades: TradeRepository;
  clock: Clock;
  logger: AuditLogger;
  config: TradingConfig;
}

export interface PortfolioView extends PortfolioState {
  drawdownPct: number;
  progressPct: number;
}

export class TradingService {
  constructor(private readonly deps: TradingDeps) {}

  private utcDateString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private ledgerDeps(): PortfolioLedgerDeps {
    return {
      signals: this.deps.signals,
      portfolio: this.deps.portfolio,
      trades: this.deps.trades,
      clock: this.deps.clock,
      logger: this.deps.logger,
      startingEquityUsdCents: this.deps.config.startingEquityUsdCents,
      targetEquityUsdCents: this.deps.config.targetEquityUsdCents,
    };
  }

  async getPortfolio(): Promise<PortfolioView> {
    const state = await ensurePortfolio(this.ledgerDeps());
    return this.toView(state);
  }

  private toView(state: PortfolioState): PortfolioView {
    const drawdownPct = state.peakEquityUsdCents > 0 ? Math.max(0, (state.peakEquityUsdCents - state.equityUsdCents) / state.peakEquityUsdCents) : 0;
    const span = state.targetEquityUsdCents - state.startingEquityUsdCents;
    const progressPct = span > 0 ? Math.min(1, Math.max(0, (state.equityUsdCents - state.startingEquityUsdCents) / span)) : 0;
    return { ...state, drawdownPct, progressPct };
  }

  async getSignal(tradeDate: string): Promise<Signal | null> {
    return this.deps.signals.findByDate(tradeDate);
  }

  async listRecentSignals(limit = 20): Promise<Signal[]> {
    return this.deps.signals.listRecent(limit);
  }

  async listRecentTrades(limit = 20): Promise<TradeRecord[]> {
    return this.deps.trades.listRecent(limit);
  }

  /** Exactly one signal per UTC calendar day — idempotent if already generated. */
  async generateDailySignal(): Promise<Signal> {
    const now = this.deps.clock.now();
    const tradeDate = this.utcDateString(now);

    const existing = await this.deps.signals.findByDate(tradeDate);
    if (existing) return existing;

    const portfolio = await ensurePortfolio(this.ledgerDeps());
    if (isDrawdownHalted(portfolio.equityUsdCents, portfolio.peakEquityUsdCents)) {
      const drawdownPct = (portfolio.peakEquityUsdCents - portfolio.equityUsdCents) / portfolio.peakEquityUsdCents;
      this.deps.logger.warn({ event: 'TRADING_HALTED_DRAWDOWN', drawdownPct }, 'daily signal generation halted');
      throw new DrawdownHaltError(drawdownPct, 0.05);
    }

    const candidates = await this.fetchCandidatePool();
    const scored = screenCandidates(candidates);
    const top = selectTopCandidate(scored);
    if (!top) {
      this.deps.logger.info({ event: 'TRADING_NO_CANDIDATE', screened: scored.length }, 'no candidate cleared the screen');
      throw new NoEligibleCandidatesError();
    }

    const bb = bollingerBands(top.metrics.klines1h);
    const volatilityFactor = bb ? Math.min(1, bb.widthPct / 0.1) : 0.5;
    const stopLossPct = stopLossPctFromVolatility(volatilityFactor);
    const rr = rewardRiskRatio(stopLossPct);
    const winProbability = winProbabilityFromScore(top.score.compositeScore);
    const allocationPct = allocationPctFromKelly(winProbability, rr);

    const lastPrice = top.metrics.ticker.lastPrice;
    const entryLow = round8(lastPrice * 0.998);
    const entryHigh = round8(lastPrice * 1.002);
    const takeProfit = round8(lastPrice * 1.05);
    const stopLoss = round8(lastPrice * (1 - stopLossPct));

    // Futures only when the perpetual is liquid and derivatives data confirms the move;
    // otherwise stay in spot per the leverage-limit mandate.
    const direction = top.metrics.futures && top.score.derivativesScore >= 60 ? 'futures_long' : 'spot_long';
    const leverage = leverageForDirection(direction);

    const signal: Signal = {
      signalId: randomUUID(),
      tradeDate,
      symbol: top.symbol,
      direction,
      leverage,
      entryLow,
      entryHigh,
      takeProfit,
      stopLoss,
      riskRewardRatio: Math.round(rr * 100) / 100,
      allocationPct: Math.round(allocationPct * 10000) / 10000,
      justification: top.justification,
      compositeScore: top.score.compositeScore,
      createdAt: now,
    };

    const saved = await this.deps.signals.create(signal);
    this.deps.logger.info(
      { event: 'TRADING_SIGNAL_GENERATED', tradeDate, symbol: saved.symbol, compositeScore: saved.compositeScore, allocationPct: saved.allocationPct },
      'daily trading signal generated',
    );
    return saved;
  }

  private async fetchCandidatePool(): Promise<CandidateMetrics[]> {
    const symbols = await this.deps.marketData.listUsdtSymbols();
    const tickers = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          return await this.deps.marketData.ticker24h(symbol);
        } catch {
          return null;
        }
      }),
    );
    const byVolume = tickers
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => b.quoteVolume - a.quoteVolume)
      .slice(0, this.deps.config.candidatePoolSize);

    const pool = await Promise.all(
      byVolume.map(async (ticker): Promise<CandidateMetrics | null> => {
        try {
          const [klines1h, klines4h, depth, futures] = await Promise.all([
            this.deps.marketData.klines(ticker.symbol, '1h', 50),
            this.deps.marketData.klines(ticker.symbol, '4h', 30),
            this.deps.marketData.depth(ticker.symbol),
            this.deps.marketData.futuresMetrics(ticker.symbol),
          ]);
          return { symbol: ticker.symbol, ticker, klines1h, klines4h, depth, futures };
        } catch (err) {
          this.deps.logger.warn({ event: 'TRADING_CANDIDATE_FETCH_FAILED', symbol: ticker.symbol, err }, 'skipping candidate');
          return null;
        }
      }),
    );
    return pool.filter((c): c is CandidateMetrics => c !== null);
  }

  /** Journal a signal's real-world outcome and update portfolio equity (idempotent per signal). */
  async recordTradeOutcome(
    signalId: string,
    outcome: SignalOutcome,
    realizedPnlUsdCents: number,
    byUserId: string,
  ): Promise<{ trade: TradeRecord; portfolio: PortfolioView }> {
    const { trade, portfolio } = await applyTradeOutcome(this.ledgerDeps(), signalId, outcome, realizedPnlUsdCents, byUserId);
    return { trade, portfolio: this.toView(portfolio) };
  }
}

function round8(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}
