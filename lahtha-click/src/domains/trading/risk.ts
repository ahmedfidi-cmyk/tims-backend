// Pure risk-management math: no I/O. Encodes the strategy's hard boundaries —
// +5.0% take-profit, a 1.5%–2.0% stop-loss band constrained to a 1:2.5–1:3
// reward:risk ratio, fractional-Kelly position sizing, ≤3x futures leverage,
// and a 5% portfolio-drawdown circuit breaker.

export const TAKE_PROFIT_PCT = 0.05;
export const STOP_LOSS_MIN_PCT = 5 / 300; // RR = 1:3 at the tightest stop (~1.667%)
export const STOP_LOSS_MAX_PCT = 0.02; // RR = 1:2.5 at the widest stop
export const MAX_LEVERAGE = 3;
export const MAX_DRAWDOWN_PCT = 0.05;
export const MAX_SINGLE_TRADE_ALLOCATION_PCT = 0.2;
export const MIN_SINGLE_TRADE_ALLOCATION_PCT = 0.02;
export const KELLY_FRACTION = 0.5; // half-Kelly — full Kelly is too aggressive for a single-asset daily bet

/**
 * Stop-loss percentage on a 0..1 volatility factor: tighter (1.667%) for calm
 * markets, wider (2.0%) for volatile ones. Always keeps reward:risk in
 * [1:2.5, 1:3] as required by the strategy mandate.
 */
export function stopLossPctFromVolatility(volatilityFactor: number): number {
  const clamped = Math.min(1, Math.max(0, volatilityFactor));
  return STOP_LOSS_MIN_PCT + clamped * (STOP_LOSS_MAX_PCT - STOP_LOSS_MIN_PCT);
}

export function rewardRiskRatio(stopLossPct: number): number {
  return TAKE_PROFIT_PCT / stopLossPct;
}

/**
 * Kelly criterion fraction f* = p − (1−p)/b, where b is the reward:risk ratio
 * and p is the estimated win probability. Never assume p ≥ 0.5 — a composite
 * factor score maps to a realistic, bounded probability band elsewhere.
 */
export function kellyFraction(winProbability: number, rewardRisk: number): number {
  const p = Math.min(1, Math.max(0, winProbability));
  const raw = p - (1 - p) / rewardRisk;
  return Math.max(0, raw);
}

/**
 * Position size as a percentage of total portfolio equity: fractional Kelly,
 * clamped to a sane single-trade ceiling (concentration risk — this is one
 * asset, not a diversified book) and a floor below which the edge isn't
 * worth the fee/slippage drag.
 */
export function allocationPctFromKelly(winProbability: number, rewardRisk: number): number {
  const full = kellyFraction(winProbability, rewardRisk);
  const fractional = full * KELLY_FRACTION;
  if (fractional <= 0) return 0;
  return Math.min(MAX_SINGLE_TRADE_ALLOCATION_PCT, Math.max(MIN_SINGLE_TRADE_ALLOCATION_PCT, fractional));
}

/**
 * Maps a 0..100 composite factor score to a conservative win-probability
 * estimate in [0.30, 0.60]. A perfect score never implies certainty — this
 * is a statistical edge, not a guarantee (E(X) framing, not a promise).
 */
export function winProbabilityFromScore(compositeScore: number): number {
  const clamped = Math.min(100, Math.max(0, compositeScore));
  return 0.3 + (clamped / 100) * 0.3;
}

export function currentDrawdownPct(equityUsdCents: number, peakEquityUsdCents: number): number {
  if (peakEquityUsdCents <= 0) return 0;
  return Math.max(0, (peakEquityUsdCents - equityUsdCents) / peakEquityUsdCents);
}

export function isDrawdownHalted(equityUsdCents: number, peakEquityUsdCents: number): boolean {
  return currentDrawdownPct(equityUsdCents, peakEquityUsdCents) >= MAX_DRAWDOWN_PCT;
}

export function leverageForDirection(direction: 'spot_long' | 'futures_long'): number {
  return direction === 'futures_long' ? MAX_LEVERAGE : 1;
}
