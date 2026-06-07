import { describe, it, expect } from 'vitest';
import {
  INITIAL_ORDER_STATE,
  InvalidOrderTransition,
  ORDER_ACTIONS,
  ORDER_STATES,
  isSuccessTerminal,
  isTerminal,
  nextOrderState,
} from '../src/domains/lahtha/checkout/order-state.js';
import { computeOrderMoney, computeRefundReversal } from '../src/domains/lahtha/checkout/order-money.js';

describe('order state machine', () => {
  it('starts in PENDING_PAYMENT', () => {
    expect(INITIAL_ORDER_STATE).toBe(ORDER_STATES.PENDING_PAYMENT);
  });

  it('routes PAY_CAPTURED by fulfillment path', () => {
    expect(nextOrderState('PENDING_PAYMENT', ORDER_ACTIONS.PAY_CAPTURED, 'digital_custody')).toBe(
      ORDER_STATES.IN_CUSTODY,
    );
    expect(nextOrderState('PENDING_PAYMENT', ORDER_ACTIONS.PAY_CAPTURED, 'physical_fulfillment')).toBe(
      ORDER_STATES.AWAITING_FULFILLMENT,
    );
  });

  it('walks the physical fulfillment path to COMPLETED', () => {
    expect(nextOrderState('AWAITING_FULFILLMENT', ORDER_ACTIONS.SHIP, 'physical_fulfillment')).toBe('SHIPPED');
    expect(nextOrderState('SHIPPED', ORDER_ACTIONS.DELIVER, 'physical_fulfillment')).toBe('COMPLETED');
  });

  it('handles payment failure and cancellation from pending', () => {
    expect(nextOrderState('PENDING_PAYMENT', ORDER_ACTIONS.PAY_FAILED, 'digital_custody')).toBe('PAYMENT_FAILED');
    expect(nextOrderState('PENDING_PAYMENT', ORDER_ACTIONS.CANCEL, 'digital_custody')).toBe('CANCELLED');
  });

  it('allows refund from post-payment states', () => {
    for (const s of ['AWAITING_FULFILLMENT', 'SHIPPED', 'COMPLETED', 'IN_CUSTODY'] as const) {
      expect(nextOrderState(s, ORDER_ACTIONS.REFUND, 'physical_fulfillment')).toBe('REFUNDED');
    }
  });

  it('rejects illegal transitions', () => {
    expect(() => nextOrderState('PENDING_PAYMENT', ORDER_ACTIONS.SHIP, 'physical_fulfillment')).toThrow(
      InvalidOrderTransition,
    );
    expect(() => nextOrderState('COMPLETED', ORDER_ACTIONS.PAY_CAPTURED, 'physical_fulfillment')).toThrow(
      InvalidOrderTransition,
    );
    expect(() => nextOrderState('CANCELLED', ORDER_ACTIONS.REFUND, 'digital_custody')).toThrow(
      InvalidOrderTransition,
    );
  });

  it('classifies terminals', () => {
    expect(isSuccessTerminal('COMPLETED')).toBe(true);
    expect(isSuccessTerminal('IN_CUSTODY')).toBe(true);
    expect(isSuccessTerminal('PENDING_PAYMENT')).toBe(false);
    expect(isTerminal('REFUNDED')).toBe(true);
    expect(isTerminal('AWAITING_FULFILLMENT')).toBe(false);
  });
});

describe('order money (integer halalat)', () => {
  it('computes subtotal + 5% commission + vendor net; total == subtotal (no VAT)', () => {
    const m = computeOrderMoney(100_000); // 1000 SAR
    expect(m).toEqual({
      subtotalHalalat: 100_000,
      commissionHalalat: 5_000,
      vendorNetHalalat: 95_000,
      totalHalalat: 100_000,
    });
  });

  it('rejects non-positive or non-integer subtotals', () => {
    expect(() => computeOrderMoney(0)).toThrow();
    expect(() => computeOrderMoney(-5)).toThrow();
    expect(() => computeOrderMoney(10.5)).toThrow();
  });

  it('full refund reverses the full commission', () => {
    const m = computeOrderMoney(100_000);
    expect(computeRefundReversal(m)).toBe(5_000);
  });
});
