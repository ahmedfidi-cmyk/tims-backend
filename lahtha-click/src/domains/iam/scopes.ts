// IAM scopes — pure RBAC claim logic (no I/O).
//
// A session carries an explicit set of scopes. LAHTHA authentication grants the
// base scopes; CLICK and other elevated scopes are NOT implied by logging in.
// They are unlocked only when BOTH hold:
//   - the vendor has reached LAHTHA_APPROVED (Rule 4 — CLICK separation), and
//   - the session has passed MFA step-up (e.g. Microsoft Entra ID).
//
// This keeps LAHTHA identity separate from CLICK authorization, as required.

export const SCOPES = {
  /** Base: any authenticated vendor session in LAHTHA. */
  LAHTHA_ACCESS: 'lahtha:access',
  /** Submit / update KYC documents. */
  LAHTHA_KYC_WRITE: 'lahtha:kyc:write',
  /** Enter the CLICK domain. Elevated. */
  CLICK_ACCESS: 'click:access',
  /** Move funds in a CLICK wallet. Elevated. */
  CLICK_WALLET_WRITE: 'click:wallet:write',
  /** Modify settlement / payout details. Elevated. */
  SETTLEMENT_WRITE: 'settlement:write',
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

/** Scopes that require MFA step-up AND an approved vendor before they are granted. */
export const ELEVATED_SCOPES: readonly Scope[] = [
  SCOPES.CLICK_ACCESS,
  SCOPES.CLICK_WALLET_WRITE,
  SCOPES.SETTLEMENT_WRITE,
];

/** Scopes every authenticated LAHTHA vendor session receives. */
const BASE_SCOPES: readonly Scope[] = [SCOPES.LAHTHA_ACCESS, SCOPES.LAHTHA_KYC_WRITE];

export function isElevatedScope(scope: Scope): boolean {
  return ELEVATED_SCOPES.includes(scope);
}

/**
 * Compute the scopes a session is entitled to.
 *
 * @param vendorApproved  vendor has reached LAHTHA_APPROVED (Rule 4 gate)
 * @param mfaVerified     this session has completed MFA step-up
 */
export function deriveScopes(vendorApproved: boolean, mfaVerified: boolean): Scope[] {
  const granted = new Set<Scope>(BASE_SCOPES);
  if (vendorApproved && mfaVerified) {
    for (const s of ELEVATED_SCOPES) granted.add(s);
  }
  // Deterministic order for stable storage / assertions.
  return [...granted].sort();
}

/** True if the session's scope set satisfies the required scope. */
export function hasScope(sessionScopes: readonly string[], required: Scope): boolean {
  return sessionScopes.includes(required);
}
