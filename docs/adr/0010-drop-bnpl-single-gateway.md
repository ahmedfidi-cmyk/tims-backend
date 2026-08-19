# ADR-0010 — Drop BNPL (Tabby/Tamara): ship with one direct gateway

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-17 |
| **Decision owners** | Owner + Engineering |
| **Supersedes** | [ADR-0002](./0002-bnpl-first.md) (BNPL-first) |
| **Amends** | [ADR-0007](./0007-payments.md) (payment adapter framework) |

## Context

ADR-0002 chose Tabby + Tamara (BNPL) for launch because their merchant onboarding is faster
than a direct card-acquiring relationship. In practice, integrating **two** BNPL providers —
each with its own hosted-checkout flow, eligibility-decline UX, webhook contract, and
reconciliation job — is real scope, and the owner does not have time for it before launch.

Neither Tabby nor Tamara were ever wired beyond a fail-closed adapter shell
(`PaymentNotConfiguredError` without credentials) — no hosted-checkout call, no live webhook
verification, no sandbox integration. Removing them costs nothing in working functionality;
it only removes adapter surface, config, and copy that referenced a launch plan the owner has
decided to change.

## Decision

**Drop BNPL for launch. Ship with exactly two payment paths:**

1. **Dev/demo stub** (`StubPaymentAdapter`) — auto-captures, never enabled in production.
2. **One direct gateway** (`MoyasarAdapter`) — card + mada, fails closed until credentialed.
   Real checkout + live webhook verification remains a credentialed follow-up, same as before —
   only now it's the *only* real provider, not one of three.

Concretely:
- `TabbyAdapter`, `TamaraAdapter`, and the shared `BnplAdapter` base class are deleted.
- `MoyasarAdapter` absorbs the configurable (`apiKey` + `webhookSecret`, HMAC-verified webhook)
  shape that `BnplAdapter` used to provide — it's no longer a bare always-throwing stub.
- `PAYMENT_PROVIDER` config narrows to `'stub' | 'moyasar'`; `TABBY_*`/`TAMARA_*` env vars are
  removed; `MOYASAR_WEBHOOK_SECRET` is added (previously missing, since Moyasar had no real
  webhook path).
- Production's implicit default provider (when `PAYMENT_PROVIDER` is unset) changes from
  `tabby` to `moyasar`.
- All "Tabby"/"Tamara" UI copy is removed from the storefront.

BNPL is not permanently off the table — if conversion data post-launch shows a real need for
installment payment, it can be reintroduced as a new adapter on the same `PaymentAdapter`
contract, same as ADR-0002 originally described. This ADR just removes it from the **launch**
critical path.

## Why

| Concern | This decision |
|---|---|
| **Time to launch** | One gateway to credential and test instead of three |
| **Integration surface** | One hosted-checkout flow, one webhook contract, one reconciliation job — not three |
| **What was actually working** | Nothing — all three provider adapters were uncredentialed fail-closed shells; no functionality is lost |
| **Direct-gateway fit** | Moyasar already covers card + mada, which is most of KSA online checkout without BNPL's eligibility-decline UX problem |
| **Reversibility** | BNPL can be added back later as a new adapter without touching the checkout state machine (ADR-0004's seam is provider-agnostic) |

## Consequences

### Positive
- Fewer credentials to chase, fewer webhook contracts to implement correctly, faster to a
  publishable state.
- `MoyasarAdapter` is now a real, useful shell (not a permanently-inert placeholder) — the
  natural next credentialed step is "get a Moyasar account," not "get three."

### Negative
- No installment/BNPL option at launch. Per ADR-0002's own mitigation plan: if customers
  abandon at checkout looking for installments, that's the signal to revisit this decision.
- Phones in the 2,000–6,000 SAR range (this product's sweet spot) are a strong BNPL use case;
  losing it may soften conversion for price-sensitive buyers until re-added.

### Mitigations
- The `PaymentAdapter` contract is unchanged — re-adding a BNPL provider later is additive
  (new adapter + config), not a rewrite.
- Track checkout abandonment post-launch as the trigger for revisiting.

## Status of ADR-0002

ADR-0002 is retained as the historical record of the original BNPL-first reasoning; its
**Status** line is updated to `Superseded by ADR-0010`. Its content is not rewritten.
