// Vendor approval — pure domain core (no I/O, no DB).
//
// This is the single source of truth for the LAHTHA vendor lifecycle. It
// encodes two hard rules from the architecture:
//   - Rule 4  (docs/architecture/iam-rbac.md): a vendor must be approved in
//     LAHTHA before it can participate in CLICK.
//   - Rule 20 (ARCHITECTURE.md §4 NFRs: immutability): every state change must
//     produce an immutable, timestamped audit record naming the actor.
//
// Keeping the transition rules pure means the business logic is fully unit
// testable without a database — the same philosophy as src/config/commission.ts.

/** Lifecycle states a vendor can occupy. */
export const VENDOR_STATES = {
  /** Just registered; must upload ownership/CR/VAT proof before review. */
  PENDING_OWNERSHIP_PROOF: 'PENDING_OWNERSHIP_PROOF',
  /** Proof submitted; queued for an admin decision. */
  PENDING_REVIEW: 'PENDING_REVIEW',
  /** Admin approved — the only state that unlocks CLICK (Rule 4). */
  LAHTHA_APPROVED: 'LAHTHA_APPROVED',
  /** Admin denied; the vendor may resubmit proof to re-enter review. */
  REJECTED: 'REJECTED',
} as const;

export type VendorState = (typeof VENDOR_STATES)[keyof typeof VENDOR_STATES];

/** Actions that drive transitions. Values double as audit-log action names. */
export const VENDOR_ACTIONS = {
  REGISTER: 'VENDOR_REGISTERED',
  SUBMIT_PROOF: 'OWNERSHIP_PROOF_SUBMITTED',
  APPROVE: 'VENDOR_APPROVED',
  REJECT: 'VENDOR_REJECTED',
} as const;

export type VendorAction = (typeof VENDOR_ACTIONS)[keyof typeof VENDOR_ACTIONS];

interface TransitionRule {
  /** States from which the action is permitted. */
  readonly from: readonly VendorState[];
  /** Resulting state. */
  readonly to: VendorState;
}

/**
 * The complete transition table. Any (action, fromState) pair not listed here
 * is illegal and will be rejected — there is no implicit "approve from any
 * state" shortcut (the bug in the original prototype).
 *
 *   PENDING_OWNERSHIP_PROOF --submit--> PENDING_REVIEW
 *   REJECTED                --submit--> PENDING_REVIEW   (resubmission)
 *   PENDING_REVIEW          --approve-> LAHTHA_APPROVED
 *   PENDING_REVIEW          --reject--> REJECTED
 */
const TRANSITIONS: Record<VendorAction, TransitionRule | null> = {
  // REGISTER has no prior state; it is handled by the factory below.
  [VENDOR_ACTIONS.REGISTER]: null,
  [VENDOR_ACTIONS.SUBMIT_PROOF]: {
    from: [VENDOR_STATES.PENDING_OWNERSHIP_PROOF, VENDOR_STATES.REJECTED],
    to: VENDOR_STATES.PENDING_REVIEW,
  },
  [VENDOR_ACTIONS.APPROVE]: {
    from: [VENDOR_STATES.PENDING_REVIEW],
    to: VENDOR_STATES.LAHTHA_APPROVED,
  },
  [VENDOR_ACTIONS.REJECT]: {
    from: [VENDOR_STATES.PENDING_REVIEW],
    to: VENDOR_STATES.REJECTED,
  },
};

/** The state every newly registered vendor starts in. */
export const INITIAL_STATE: VendorState = VENDOR_STATES.PENDING_OWNERSHIP_PROOF;

/** Raised when an action is attempted from a state that does not permit it. */
export class InvalidTransitionError extends Error {
  readonly from: VendorState;
  readonly action: VendorAction;
  constructor(from: VendorState, action: VendorAction) {
    super(`Cannot perform "${action}" from state "${from}"`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.action = action;
  }
}

/** Returns true if the action is legal from the given state. */
export function canTransition(from: VendorState, action: VendorAction): boolean {
  const rule = TRANSITIONS[action];
  return rule !== null && rule.from.includes(from);
}

/**
 * Compute the next state for an action, or throw InvalidTransitionError.
 * Pure: it only maps (state, action) -> state.
 */
export function applyTransition(from: VendorState, action: VendorAction): VendorState {
  const rule = TRANSITIONS[action];
  if (rule === null || !rule.from.includes(from)) {
    throw new InvalidTransitionError(from, action);
  }
  return rule.to;
}

/**
 * Rule 4 gate. CLICK participation is allowed only once a vendor has reached
 * LAHTHA_APPROVED — never from any pending or rejected state.
 */
export function canParticipateInClick(state: VendorState): boolean {
  return state === VENDOR_STATES.LAHTHA_APPROVED;
}

/** True for states from which no further transition is possible. */
export function isTerminal(state: VendorState): boolean {
  return state === VENDOR_STATES.LAHTHA_APPROVED;
}
