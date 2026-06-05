import { describe, it, expect } from 'vitest';
import {
  applyTransition,
  canParticipateInClick,
  canTransition,
  InvalidTransitionError,
  INITIAL_STATE,
  isTerminal,
  VENDOR_ACTIONS,
  VENDOR_STATES,
} from '../src/domains/lahtha/vendor/vendor-approval.js';

describe('vendor approval state machine', () => {
  it('new vendors start in PENDING_OWNERSHIP_PROOF', () => {
    expect(INITIAL_STATE).toBe(VENDOR_STATES.PENDING_OWNERSHIP_PROOF);
  });

  it('submitting proof moves PENDING_OWNERSHIP_PROOF -> PENDING_REVIEW', () => {
    expect(
      applyTransition(VENDOR_STATES.PENDING_OWNERSHIP_PROOF, VENDOR_ACTIONS.SUBMIT_PROOF),
    ).toBe(VENDOR_STATES.PENDING_REVIEW);
  });

  it('approval moves PENDING_REVIEW -> LAHTHA_APPROVED', () => {
    expect(applyTransition(VENDOR_STATES.PENDING_REVIEW, VENDOR_ACTIONS.APPROVE)).toBe(
      VENDOR_STATES.LAHTHA_APPROVED,
    );
  });

  it('rejection moves PENDING_REVIEW -> REJECTED', () => {
    expect(applyTransition(VENDOR_STATES.PENDING_REVIEW, VENDOR_ACTIONS.REJECT)).toBe(
      VENDOR_STATES.REJECTED,
    );
  });

  it('a rejected vendor can resubmit proof back into review', () => {
    expect(applyTransition(VENDOR_STATES.REJECTED, VENDOR_ACTIONS.SUBMIT_PROOF)).toBe(
      VENDOR_STATES.PENDING_REVIEW,
    );
  });

  it('cannot approve straight from PENDING_OWNERSHIP_PROOF (no review shortcut)', () => {
    expect(() =>
      applyTransition(VENDOR_STATES.PENDING_OWNERSHIP_PROOF, VENDOR_ACTIONS.APPROVE),
    ).toThrow(InvalidTransitionError);
  });

  it('cannot approve an already-approved vendor', () => {
    expect(() =>
      applyTransition(VENDOR_STATES.LAHTHA_APPROVED, VENDOR_ACTIONS.APPROVE),
    ).toThrow(InvalidTransitionError);
  });

  it('cannot reject a vendor that is not under review', () => {
    expect(() =>
      applyTransition(VENDOR_STATES.PENDING_OWNERSHIP_PROOF, VENDOR_ACTIONS.REJECT),
    ).toThrow(InvalidTransitionError);
    expect(() =>
      applyTransition(VENDOR_STATES.LAHTHA_APPROVED, VENDOR_ACTIONS.REJECT),
    ).toThrow(InvalidTransitionError);
  });

  it('canTransition agrees with applyTransition', () => {
    expect(canTransition(VENDOR_STATES.PENDING_REVIEW, VENDOR_ACTIONS.APPROVE)).toBe(true);
    expect(canTransition(VENDOR_STATES.PENDING_OWNERSHIP_PROOF, VENDOR_ACTIONS.APPROVE)).toBe(
      false,
    );
  });

  it('InvalidTransitionError carries the offending state and action', () => {
    try {
      applyTransition(VENDOR_STATES.REJECTED, VENDOR_ACTIONS.APPROVE);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransitionError);
      const e = err as InvalidTransitionError;
      expect(e.from).toBe(VENDOR_STATES.REJECTED);
      expect(e.action).toBe(VENDOR_ACTIONS.APPROVE);
    }
  });

  describe('Rule 4 — CLICK access gate', () => {
    it('only LAHTHA_APPROVED unlocks CLICK', () => {
      expect(canParticipateInClick(VENDOR_STATES.LAHTHA_APPROVED)).toBe(true);
    });

    it('every non-approved state is blocked from CLICK', () => {
      for (const state of [
        VENDOR_STATES.PENDING_OWNERSHIP_PROOF,
        VENDOR_STATES.PENDING_REVIEW,
        VENDOR_STATES.REJECTED,
      ]) {
        expect(canParticipateInClick(state)).toBe(false);
      }
    });
  });

  it('LAHTHA_APPROVED is the only terminal state', () => {
    expect(isTerminal(VENDOR_STATES.LAHTHA_APPROVED)).toBe(true);
    expect(isTerminal(VENDOR_STATES.PENDING_REVIEW)).toBe(false);
    expect(isTerminal(VENDOR_STATES.REJECTED)).toBe(false);
  });
});
