// Checkout order lifecycle — pure dual-path state machine (no I/O).
//
// The path (physical_fulfillment | digital_custody) is fixed at creation and
// determines where PAY_CAPTURED routes. Illegal transitions throw, exactly like
// the vendor-approval machine.

export const FULFILLMENT_TYPES = ['physical_fulfillment', 'digital_custody'] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export const ORDER_STATES = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  AWAITING_FULFILLMENT: 'AWAITING_FULFILLMENT',
  SHIPPED: 'SHIPPED',
  COMPLETED: 'COMPLETED', // physical success terminal
  IN_CUSTODY: 'IN_CUSTODY', // digital success terminal
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;
export type OrderState = (typeof ORDER_STATES)[keyof typeof ORDER_STATES];

export const ORDER_ACTIONS = {
  PAY_CAPTURED: 'PAY_CAPTURED',
  PAY_FAILED: 'PAY_FAILED',
  CANCEL: 'CANCEL',
  SHIP: 'SHIP',
  DELIVER: 'DELIVER',
  REFUND: 'REFUND',
} as const;
export type OrderAction = (typeof ORDER_ACTIONS)[keyof typeof ORDER_ACTIONS];

export const INITIAL_ORDER_STATE: OrderState = ORDER_STATES.PENDING_PAYMENT;

const REFUNDABLE: readonly OrderState[] = [
  ORDER_STATES.AWAITING_FULFILLMENT,
  ORDER_STATES.SHIPPED,
  ORDER_STATES.COMPLETED,
  ORDER_STATES.IN_CUSTODY,
];

export class InvalidOrderTransition extends Error {
  constructor(public readonly from: OrderState, public readonly action: OrderAction) {
    super(`Cannot ${action} an order in state ${from}`);
    this.name = 'InvalidOrderTransition';
  }
}

/**
 * Pure next-state for an (state, action) pair. PAY_CAPTURED is path-dependent:
 * physical → AWAITING_FULFILLMENT, digital → IN_CUSTODY (custody handoff).
 */
export function nextOrderState(
  from: OrderState,
  action: OrderAction,
  fulfillmentType: FulfillmentType,
): OrderState {
  switch (action) {
    case ORDER_ACTIONS.PAY_CAPTURED:
      if (from !== ORDER_STATES.PENDING_PAYMENT) break;
      return fulfillmentType === 'digital_custody'
        ? ORDER_STATES.IN_CUSTODY
        : ORDER_STATES.AWAITING_FULFILLMENT;
    case ORDER_ACTIONS.PAY_FAILED:
      if (from === ORDER_STATES.PENDING_PAYMENT) return ORDER_STATES.PAYMENT_FAILED;
      break;
    case ORDER_ACTIONS.CANCEL:
      if (from === ORDER_STATES.PENDING_PAYMENT) return ORDER_STATES.CANCELLED;
      break;
    case ORDER_ACTIONS.SHIP:
      if (from === ORDER_STATES.AWAITING_FULFILLMENT) return ORDER_STATES.SHIPPED;
      break;
    case ORDER_ACTIONS.DELIVER:
      if (from === ORDER_STATES.SHIPPED) return ORDER_STATES.COMPLETED;
      break;
    case ORDER_ACTIONS.REFUND:
      if (REFUNDABLE.includes(from)) return ORDER_STATES.REFUNDED;
      break;
  }
  throw new InvalidOrderTransition(from, action);
}

export function isSuccessTerminal(state: OrderState): boolean {
  return state === ORDER_STATES.COMPLETED || state === ORDER_STATES.IN_CUSTODY;
}

export function isTerminal(state: OrderState): boolean {
  return (
    isSuccessTerminal(state) ||
    state === ORDER_STATES.PAYMENT_FAILED ||
    state === ORDER_STATES.CANCELLED ||
    state === ORDER_STATES.REFUNDED
  );
}
