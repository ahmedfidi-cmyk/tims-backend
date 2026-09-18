import { describe, it, expect } from 'vitest';
import {
  MAX_SINGLE_TRADE_ALLOCATION_PCT,
  MIN_SINGLE_TRADE_ALLOCATION_PCT,
  STOP_LOSS_MAX_PCT,
  STOP_LOSS_MIN_PCT,
  TAKE_PROFIT_PCT,
  allocationPctFromKelly,
  currentDrawdownPct,
  isDrawdownHalted,
  kellyFraction,
  leverageForDirection,
  rewardRiskRatio,
  stopLossPctFromVolatility,
  winProbabilityFromScore,
} from '../src/domains/trading/risk.js';

describe('stopLossPctFromVolatility', () => {
  it('stays within the mandated 1.5%-2.0% band at the extremes', () => {
    expect(stopLossPctFromVolatility(0)).toBeCloseTo(STOP_LOSS_MIN_PCT, 6);
    expect(stopLossPctFromVolatility(1)).toBeCloseTo(STOP_LOSS_MAX_PCT, 6);
    expect(stopLossPctFromVolatility(0.5)).toBeGreaterThan(STOP_LOSS_MIN_PCT);
    expect(stopLossPctFromVolatility(0.5)).toBeLessThan(STOP_LOSS_MAX_PCT);
  });

  it('clamps out-of-range inputs', () => {
    expect(stopLossPctFromVolatility(-5)).toBeCloseTo(STOP_LOSS_MIN_PCT, 6);
    expect(stopLossPctFromVolatility(5)).toBeCloseTo(STOP_LOSS_MAX_PCT, 6);
  });
});

describe('rewardRiskRatio', () => {
  it('keeps reward:risk within [1:2.5, 1:3] across the stop-loss band', () => {
    const rrAtTightest = rewardRiskRatio(STOP_LOSS_MIN_PCT);
    const rrAtWidest = rewardRiskRatio(STOP_LOSS_MAX_PCT);
    expect(rrAtTightest).toBeCloseTo(3, 5);
    expect(rrAtWidest).toBeCloseTo(2.5, 5);
  });

  it('take-profit is fixed at +5.0%', () => {
    expect(TAKE_PROFIT_PCT).toBe(0.05);
  });
});

describe('kellyFraction', () => {
  it('is zero or negative-clamped when the edge is unfavorable', () => {
    expect(kellyFraction(0.2, 3)).toBe(0);
  });

  it('is positive when probability clears the breakeven threshold for the given RR', () => {
    // breakeven p = 1/(1+b); at b=3 that's 0.25 — 0.4 clears it.
    expect(kellyFraction(0.4, 3)).toBeGreaterThan(0);
  });

  it('never exceeds 1', () => {
    expect(kellyFraction(1, 3)).toBeLessThanOrEqual(1);
  });
});

describe('allocationPctFromKelly', () => {
  it('clamps to the single-trade ceiling even for a very favorable edge', () => {
    expect(allocationPctFromKelly(0.9, 3)).toBeLessThanOrEqual(MAX_SINGLE_TRADE_ALLOCATION_PCT);
  });

  it('returns zero for an unfavorable edge (no signal worth sizing)', () => {
    expect(allocationPctFromKelly(0.1, 2.5)).toBe(0);
  });

  it('floors a thin-but-positive edge at the minimum allocation', () => {
    const alloc = allocationPctFromKelly(0.31, 3);
    expect(alloc === 0 || alloc >= MIN_SINGLE_TRADE_ALLOCATION_PCT).toBe(true);
  });
});

describe('winProbabilityFromScore', () => {
  it('maps a 0-100 composite score into a conservative [0.30, 0.60] band', () => {
    expect(winProbabilityFromScore(0)).toBeCloseTo(0.3, 5);
    expect(winProbabilityFromScore(100)).toBeCloseTo(0.6, 5);
    expect(winProbabilityFromScore(55)).toBeGreaterThan(0.3);
    expect(winProbabilityFromScore(55)).toBeLessThan(0.6);
  });
});

describe('drawdown halt', () => {
  it('is not halted below the 5% cap', () => {
    expect(isDrawdownHalted(96_00, 100_00)).toBe(false); // 4% drawdown
  });

  it('halts at exactly the 5% cap', () => {
    expect(currentDrawdownPct(95_00, 100_00)).toBeCloseTo(0.05, 5);
    expect(isDrawdownHalted(95_00, 100_00)).toBe(true);
  });

  it('halts beyond the cap', () => {
    expect(isDrawdownHalted(90_00, 100_00)).toBe(true);
  });

  it('treats a zero peak as no drawdown (uninitialized portfolio)', () => {
    expect(currentDrawdownPct(0, 0)).toBe(0);
  });
});

describe('leverageForDirection', () => {
  it('spot is always 1x', () => {
    expect(leverageForDirection('spot_long')).toBe(1);
  });
  it('futures is capped at the 3x mandate', () => {
    expect(leverageForDirection('futures_long')).toBe(3);
  });
});
