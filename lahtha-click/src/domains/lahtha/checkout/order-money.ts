// Order money breakdown — pure, integer halalat (decimal-safe, NFR). Reuses the
// platform commission policy. W4: total == subtotal (no VAT yet).

import { computeCommissionHalalat, computeRefundCommissionReversalHalalat } from '../../../config/commission.js';

export interface OrderMoney {
  subtotalHalalat: number;
  commissionHalalat: number;
  vendorNetHalalat: number;
  totalHalalat: number;
}

/** Breakdown for a primary LAHZA sale: buyer pays subtotal; vendor nets subtotal − commission. */
export function computeOrderMoney(subtotalHalalat: number): OrderMoney {
  if (!Number.isInteger(subtotalHalalat) || subtotalHalalat <= 0) {
    throw new Error(`subtotalHalalat must be a positive integer, got ${subtotalHalalat}`);
  }
  const commissionHalalat = computeCommissionHalalat(subtotalHalalat, 'lahzaPrimarySale');
  return {
    subtotalHalalat,
    commissionHalalat,
    vendorNetHalalat: subtotalHalalat - commissionHalalat,
    totalHalalat: subtotalHalalat, // no VAT in W4
  };
}

/** Full-refund commission reversal for an order (W4 refunds are whole-order). */
export function computeRefundReversal(money: OrderMoney): number {
  return computeRefundCommissionReversalHalalat(
    money.subtotalHalalat,
    money.subtotalHalalat,
    money.commissionHalalat,
  );
}
