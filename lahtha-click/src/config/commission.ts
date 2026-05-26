// Commission policy — single source of truth for platform fee math.
// See docs/product/commission-policy.md for the commercial rationale.
//
// Hard rule: no commission rule may exceed MAX_RATE_BPS. Enforced at module
// load (so a misconfigured rate fails to start the process) AND at the call
// site (so a future runtime mutation can't slip through).

export type CommissionType =
  | 'lahzaPrimarySale'
  | 'clickAuctionBuyer'
  | 'clickAuctionSeller';

export interface CommissionRule {
  /** Rate in basis points. 500 = 5.00%. */
  rateBps: number;
  /** Optional floor (in halalat). */
  minHalalat?: number;
  /** Optional ceiling (in halalat). */
  maxHalalat?: number;
}

/** Platform ceiling: no order may incur more than 5% in total commission. */
export const MAX_RATE_BPS = 500;

/** 1 SAR = 100 halalat. All money is integer halalat. */
const BPS_DIVISOR = 10_000;

export const COMMISSION_DEFAULTS: Record<CommissionType, CommissionRule> = {
  // LAHZA B2C: vendor pays the full 5% out of their settlement.
  lahzaPrimarySale:   { rateBps: 500 },
  // CLICK auction: split 50/50 — buyer 2.5%, seller 2.5%. Sum = 5%.
  clickAuctionBuyer:  { rateBps: 250 },
  clickAuctionSeller: { rateBps: 250 },
};

(function enforceCeilingAtLoad(): void {
  for (const [type, rule] of Object.entries(COMMISSION_DEFAULTS) as Array<[CommissionType, CommissionRule]>) {
    if (rule.rateBps > MAX_RATE_BPS) {
      throw new Error(
        `Commission rule "${type}" rate ${rule.rateBps}bps exceeds platform max ${MAX_RATE_BPS}bps`,
      );
    }
  }
})();

/**
 * Compute the commission in halalat for an amount on a given commission surface.
 * Integer math throughout (no floats). Rounds down — the platform never
 * collects a fractional halalat; the leftover stays with the counterparty.
 */
export function computeCommissionHalalat(
  amountHalalat: number,
  type: CommissionType,
): number {
  if (!Number.isInteger(amountHalalat) || amountHalalat < 0) {
    throw new Error(`amountHalalat must be a non-negative integer, got ${amountHalalat}`);
  }
  const rule = COMMISSION_DEFAULTS[type];
  if (rule.rateBps > MAX_RATE_BPS) {
    throw new Error(
      `Commission rule "${type}" rate ${rule.rateBps}bps exceeds platform max ${MAX_RATE_BPS}bps`,
    );
  }
  let fee = Math.floor((amountHalalat * rule.rateBps) / BPS_DIVISOR);
  if (rule.minHalalat !== undefined && fee < rule.minHalalat) fee = rule.minHalalat;
  if (rule.maxHalalat !== undefined && fee > rule.maxHalalat) fee = rule.maxHalalat;
  return fee;
}

/**
 * Reverse a previously-computed commission by the same proportion the refund
 * bears to the original amount. Used by the saga compensation path.
 */
export function computeRefundCommissionReversalHalalat(
  originalAmountHalalat: number,
  refundedAmountHalalat: number,
  originalCommissionHalalat: number,
): number {
  if (refundedAmountHalalat > originalAmountHalalat) {
    throw new Error('Refund cannot exceed original amount');
  }
  if (originalAmountHalalat === 0) return 0;
  return Math.floor((originalCommissionHalalat * refundedAmountHalalat) / originalAmountHalalat);
}
