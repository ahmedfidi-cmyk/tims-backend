import { describe, it, expect } from 'vitest';
import {
  MIN_24H_QUOTE_VOLUME_USD,
  MIN_COMPOSITE_SCORE,
  passesLiquidityGate,
  screenCandidates,
  scoreCandidate,
  selectTopCandidate,
} from '../src/domains/trading/screening.js';
import type { CandidateMetrics, Kline, Ticker24h } from '../src/domains/trading/types.js';

function ticker(overrides: Partial<Ticker24h> = {}): Ticker24h {
  return {
    symbol: 'BTCUSDT',
    lastPrice: 100,
    priceChangePercent: 1,
    quoteVolume: MIN_24H_QUOTE_VOLUME_USD * 2,
    bidPrice: 99.95,
    askPrice: 100.05,
    ...overrides,
  };
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

/** Gentle uptrend with pullbacks — moderate RSI, tight-ish range, price ends above VWAP. */
function goodTrendCloses(base = 100, bars = 40): number[] {
  const closes: number[] = [base];
  for (let i = 1; i < bars; i += 1) {
    const step = i % 3 === 0 ? -0.1 : 0.3;
    closes.push(closes.at(-1)! + step);
  }
  return closes;
}

/** Monotonic, unbroken uptrend — pushes RSI to 100 (overbought). */
function overboughtCloses(base = 100, bars = 40): number[] {
  const closes: number[] = [base];
  for (let i = 1; i < bars; i += 1) closes.push(closes.at(-1)! + 0.5);
  return closes;
}

function baseCandidate(overrides: Partial<CandidateMetrics> = {}): CandidateMetrics {
  const closes = goodTrendCloses();
  return {
    symbol: 'BTCUSDT',
    ticker: ticker(),
    klines1h: makeKlines(closes),
    klines4h: makeKlines(closes.filter((_, i) => i % 4 === 0)),
    depth: { bidDepthUsd: 500_000, askDepthUsd: 500_000 },
    futures: null,
    ...overrides,
  };
}

describe('passesLiquidityGate', () => {
  it('rejects 24h quote volume below $10M', () => {
    expect(passesLiquidityGate(ticker({ quoteVolume: MIN_24H_QUOTE_VOLUME_USD - 1 }))).toBe(false);
  });

  it('rejects an abnormally wide bid/ask spread', () => {
    expect(passesLiquidityGate(ticker({ bidPrice: 90, askPrice: 100 }))).toBe(false);
  });

  it('passes a liquid, tight-spread ticker', () => {
    expect(passesLiquidityGate(ticker())).toBe(true);
  });
});

describe('scoreCandidate — order-flow layer', () => {
  it('rewards bid-side depth accumulation over a balanced book', () => {
    const bidHeavy = scoreCandidate(baseCandidate({ depth: { bidDepthUsd: 900_000, askDepthUsd: 100_000 } }));
    const balanced = scoreCandidate(baseCandidate({ depth: { bidDepthUsd: 500_000, askDepthUsd: 500_000 } }));
    expect(bidHeavy.orderFlowScore).toBeGreaterThan(balanced.orderFlowScore);
  });
});

describe('scoreCandidate — derivatives layer', () => {
  it('is neutral (50) with no perpetual contract', () => {
    expect(scoreCandidate(baseCandidate({ futures: null })).derivativesScore).toBe(50);
  });

  it('penalizes extreme positive (crowded-long) funding vs. mild positive funding', () => {
    const mild = scoreCandidate(baseCandidate({ futures: { fundingRate: 0.0002, openInterest: 1, openInterestChangePercent: 0 } }));
    const crowded = scoreCandidate(baseCandidate({ futures: { fundingRate: 0.002, openInterest: 1, openInterestChangePercent: 0 } }));
    expect(mild.derivativesScore).toBeGreaterThan(crowded.derivativesScore);
  });

  it('rewards OI expansion confirming a price breakout', () => {
    const confirmed = scoreCandidate(
      baseCandidate({ ticker: ticker({ priceChangePercent: 5 }), futures: { fundingRate: 0, openInterest: 1, openInterestChangePercent: 5 } }),
    );
    const unconfirmed = scoreCandidate(baseCandidate({ futures: { fundingRate: 0, openInterest: 1, openInterestChangePercent: 0 } }));
    expect(confirmed.derivativesScore).toBeGreaterThan(unconfirmed.derivativesScore);
  });
});

describe('scoreCandidate — technical layer', () => {
  it('penalizes an overbought RSI (unbroken rally) vs. a moderate uptrend', () => {
    const moderate = scoreCandidate(baseCandidate());
    const overbought = scoreCandidate(baseCandidate({ klines1h: makeKlines(overboughtCloses()) }));
    expect(moderate.technicalScore).toBeGreaterThan(overbought.technicalScore);
  });
});

describe('screenCandidates + selectTopCandidate', () => {
  it('filters out candidates that fail the liquidity gate', () => {
    const illiquid = baseCandidate({ ticker: ticker({ quoteVolume: 1000 }) });
    const liquid = baseCandidate();
    const scored = screenCandidates([illiquid, liquid]);
    expect(scored).toHaveLength(1);
    expect(scored[0]!.symbol).toBe(liquid.symbol);
  });

  it('ranks candidates by descending composite score', () => {
    const strong = baseCandidate({ depth: { bidDepthUsd: 900_000, askDepthUsd: 100_000 } });
    const weak = baseCandidate({ klines1h: makeKlines(overboughtCloses()), depth: { bidDepthUsd: 100_000, askDepthUsd: 900_000 } });
    const scored = screenCandidates([weak, strong]);
    expect(scored[0]!.symbol).toBe(strong.symbol);
    expect(scored[0]!.score.compositeScore).toBeGreaterThanOrEqual(scored[1]!.score.compositeScore);
  });

  it('emits a 3-bullet justification per candidate', () => {
    const [scored] = screenCandidates([baseCandidate()]);
    expect(scored!.justification).toHaveLength(3);
    for (const bullet of scored!.justification) expect(bullet.length).toBeGreaterThan(0);
  });

  it('returns null when nothing clears the minimum composite score', () => {
    const veryWeak = screenCandidates([
      baseCandidate({ klines1h: makeKlines(overboughtCloses()), depth: { bidDepthUsd: 1, askDepthUsd: 999_999 }, futures: { fundingRate: 0.01, openInterest: 1, openInterestChangePercent: -10 } }),
    ]);
    expect(selectTopCandidate(veryWeak)).toBeNull();
  });

  it('returns the top candidate once it clears MIN_COMPOSITE_SCORE', () => {
    const strong = baseCandidate({ depth: { bidDepthUsd: 900_000, askDepthUsd: 100_000 } });
    const scored = screenCandidates([strong]);
    if (scored[0]!.score.compositeScore >= MIN_COMPOSITE_SCORE) {
      expect(selectTopCandidate(scored)?.symbol).toBe(strong.symbol);
    } else {
      expect(selectTopCandidate(scored)).toBeNull();
    }
  });
});
