// The 4-layer alpha filter: order-flow/depth, derivatives, technical
// confluence, and volume/liquidity gating. Pure scoring over already-fetched
// market data — no I/O. On-chain/mining metrics (hashrate migration, exchange
// net-flows) aren't derivable from Binance's public market-data API, so that
// layer is intentionally omitted rather than faked; see docs/adr/0011-trading-signal-agent.md.

import { bollingerBands, rsi, vwap } from './indicators.js';
import type { CandidateMetrics, FactorScoreBreakdown, ScoredCandidate } from './types.js';

export const MIN_24H_QUOTE_VOLUME_USD = 10_000_000;
export const MAX_SPREAD_PCT = 0.005; // 0.5% — reject abnormally wide bid/ask spreads
export const MIN_COMPOSITE_SCORE = 55;

export function passesLiquidityGate(ticker: CandidateMetrics['ticker']): boolean {
  if (ticker.quoteVolume < MIN_24H_QUOTE_VOLUME_USD) return false;
  if (ticker.bidPrice <= 0 || ticker.askPrice <= 0) return false;
  const mid = (ticker.bidPrice + ticker.askPrice) / 2;
  const spreadPct = (ticker.askPrice - ticker.bidPrice) / mid;
  return spreadPct <= MAX_SPREAD_PCT;
}

/** Layer 1 — order-book depth imbalance (bid-side accumulation reads bullish). */
function scoreOrderFlow(metrics: CandidateMetrics): number {
  const { bidDepthUsd, askDepthUsd } = metrics.depth;
  const total = bidDepthUsd + askDepthUsd;
  if (total <= 0) return 50;
  const imbalance = bidDepthUsd / total; // 0..1, 0.5 = balanced book
  return Math.round(imbalance * 100);
}

/** Layer 2 — derivatives: funding rate crowding + open-interest expansion with price. */
function scoreDerivatives(metrics: CandidateMetrics): number {
  const { futures, ticker } = metrics;
  if (!futures) return 50; // no perpetual contract for this symbol — neutral, spot-only
  let score = 50;
  // Reward mild positive funding (bullish lean); penalize extreme crowding.
  if (futures.fundingRate > 0 && futures.fundingRate < 0.0005) score += 15;
  else if (futures.fundingRate >= 0.0005) score -= 20;
  else if (futures.fundingRate < 0) score -= 5;
  // OI expanding alongside a price breakout confirms conviction behind the move.
  if (futures.openInterestChangePercent > 2 && ticker.priceChangePercent > 0) score += 20;
  else if (futures.openInterestChangePercent < -2) score -= 10;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/** Layer 3 — technical confluence: BB squeeze, VWAP breakout, RSI momentum (not overbought). */
function scoreTechnical(metrics: CandidateMetrics): number {
  const bb = bollingerBands(metrics.klines1h);
  const rsiValue = rsi(metrics.klines1h);
  const vwapValue = vwap(metrics.klines4h);
  const lastClose = metrics.klines1h.at(-1)?.close ?? metrics.ticker.lastPrice;

  let score = 40;
  // Volatility contraction (squeeze) — a tight band precedes expansion.
  if (bb) {
    if (bb.widthPct < 0.04) score += 20;
    else if (bb.widthPct < 0.08) score += 10;
  }
  // VWAP anchor breakout.
  if (vwapValue !== null && lastClose > vwapValue) score += 20;
  // RSI bullish momentum without being overbought.
  if (rsiValue !== null) {
    if (rsiValue >= 50 && rsiValue <= 70) score += 20;
    else if (rsiValue > 70) score -= 15; // overbought — avoid chasing
    else if (rsiValue < 40) score -= 10;
  }
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function scoreCandidate(metrics: CandidateMetrics): FactorScoreBreakdown {
  const orderFlowScore = scoreOrderFlow(metrics);
  const derivativesScore = scoreDerivatives(metrics);
  const technicalScore = scoreTechnical(metrics);
  const compositeScore = Math.round(orderFlowScore * 0.3 + derivativesScore * 0.3 + technicalScore * 0.4);
  return { orderFlowScore, derivativesScore, technicalScore, compositeScore };
}

function buildJustification(metrics: CandidateMetrics, score: FactorScoreBreakdown): [string, string, string] {
  const bb = bollingerBands(metrics.klines1h);
  const rsiValue = rsi(metrics.klines1h);
  const bullets: string[] = [];

  bullets.push(
    score.orderFlowScore >= 60
      ? `Bid-side order-book depth dominates (${score.orderFlowScore}/100 imbalance), signaling accumulation.`
      : `Order-book depth is roughly balanced (${score.orderFlowScore}/100); flow is not a strong driver here.`,
  );

  if (metrics.futures) {
    bullets.push(
      `Funding rate ${(metrics.futures.fundingRate * 100).toFixed(3)}%, OI change ${metrics.futures.openInterestChangePercent.toFixed(1)}% — derivatives score ${score.derivativesScore}/100.`,
    );
  } else {
    bullets.push(`No perpetual contract on this pair; derivatives layer held neutral (${score.derivativesScore}/100).`);
  }

  const squeeze = bb ? `BB width ${(bb.widthPct * 100).toFixed(1)}%` : 'insufficient BB history';
  const rsiText = rsiValue !== null ? `RSI ${rsiValue.toFixed(1)}` : 'RSI unavailable';
  bullets.push(`${squeeze}, ${rsiText}, VWAP-anchored technical score ${score.technicalScore}/100.`);

  return bullets as [string, string, string];
}

/** Score every liquid candidate and rank descending; empty when none clear the gate. */
export function screenCandidates(candidates: CandidateMetrics[]): ScoredCandidate[] {
  return candidates
    .filter((c) => passesLiquidityGate(c.ticker))
    .map((metrics) => {
      const score = scoreCandidate(metrics);
      return { symbol: metrics.symbol, metrics, score, justification: buildJustification(metrics, score) };
    })
    .sort((a, b) => b.score.compositeScore - a.score.compositeScore);
}

/** Pick the single best candidate for the day, or null if none meets the minimum bar. */
export function selectTopCandidate(scored: ScoredCandidate[]): ScoredCandidate | null {
  const top = scored[0];
  if (!top || top.score.compositeScore < MIN_COMPOSITE_SCORE) return null;
  return top;
}
