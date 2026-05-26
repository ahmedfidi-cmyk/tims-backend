import { describe, it, expect } from 'vitest';
import {
  COMMISSION_DEFAULTS,
  MAX_RATE_BPS,
  computeCommissionHalalat,
  computeRefundCommissionReversalHalalat,
} from '../src/config/commission.js';

describe('commission policy', () => {
  it('all default rules stay at or below the 5% ceiling', () => {
    for (const [, rule] of Object.entries(COMMISSION_DEFAULTS)) {
      expect(rule.rateBps).toBeLessThanOrEqual(MAX_RATE_BPS);
    }
  });

  it('CLICK auction buyer + seller cuts sum to exactly the ceiling', () => {
    const total =
      COMMISSION_DEFAULTS.clickAuctionBuyer.rateBps +
      COMMISSION_DEFAULTS.clickAuctionSeller.rateBps;
    expect(total).toBe(MAX_RATE_BPS);
  });

  it('matches the worked example from commission-policy.md', () => {
    // Subtotal 4347.83 SAR = 434_783 halalat
    // 5% = 21_739.15 → floored = 21_739 halalat
    const subtotalHalalat = 434_783;
    const commission = computeCommissionHalalat(subtotalHalalat, 'lahzaPrimarySale');
    expect(commission).toBe(21_739);
  });

  it('rounds down — never collects fractional halalat', () => {
    // 1 halalat * 500 / 10000 = 0.05 → floor = 0
    expect(computeCommissionHalalat(1, 'lahzaPrimarySale')).toBe(0);
    // 20 halalat * 500 / 10000 = 1.0 → 1
    expect(computeCommissionHalalat(20, 'lahzaPrimarySale')).toBe(1);
    // 19 halalat * 500 / 10000 = 0.95 → floor = 0
    expect(computeCommissionHalalat(19, 'lahzaPrimarySale')).toBe(0);
  });

  it('rejects non-integer or negative amounts', () => {
    expect(() => computeCommissionHalalat(1.5, 'lahzaPrimarySale')).toThrow();
    expect(() => computeCommissionHalalat(-100, 'lahzaPrimarySale')).toThrow();
  });

  it('zero amount yields zero commission', () => {
    expect(computeCommissionHalalat(0, 'lahzaPrimarySale')).toBe(0);
  });

  describe('refund reversal', () => {
    it('full refund reverses the full commission', () => {
      const reversed = computeRefundCommissionReversalHalalat(434_783, 434_783, 21_739);
      expect(reversed).toBe(21_739);
    });

    it('half refund reverses half the commission (floored)', () => {
      const reversed = computeRefundCommissionReversalHalalat(1000, 500, 50);
      expect(reversed).toBe(25);
    });

    it('refund larger than original throws', () => {
      expect(() =>
        computeRefundCommissionReversalHalalat(1000, 1500, 50),
      ).toThrow(/Refund cannot exceed/);
    });

    it('zero original amount yields zero reversal', () => {
      expect(computeRefundCommissionReversalHalalat(0, 0, 0)).toBe(0);
    });
  });
});
