# ADR-0007 — Payments: adapter framework, intents & webhook (drives the checkout seam)

| | |
|---|---|
| **Status** | Accepted (backend; real providers are credentialed follow-ups) |
| **Date** | 2026-06-16 |
| **Decision owners** | Engineering + Owner |
| **Implements** | [ADR-0002](./0002-bnpl-first.md) (BNPL-first) |
| **Relates to** | [ADR-0004](./0004-checkout-state-machine.md) (`applyPaymentResult` seam), commission policy |

## Context

Orders are created `PENDING_PAYMENT` and only advance when `CheckoutService.applyPaymentResult`
is called — today only via an admin-gated `payment-event` endpoint. There is no way for a
customer to actually pay, so the storefront flow dead-ends. ADR-0002 chose **BNPL-first**
(Tabby/Tamara) with a stub direct gateway, but no providers are wired and we have no credentials
in this environment.

## Decision

Add a `payment` domain (`src/domains/lahtha/payment/`) that turns the seam into a real flow,
while staying runnable without provider credentials.

### PaymentAdapter contract
```
PaymentAdapter {
  provider: string                       // 'stub' | 'tabby' | 'tamara' | 'moyasar'
  createIntent(args): Promise<{ intentId; redirectUrl?; autoCaptured: boolean }>
  verifyWebhook(headers, rawBody): Promise<{ intentId; outcome: 'captured'|'failed' }>
}
```
- **StubPaymentAdapter** (dev/test default): `createIntent` returns `autoCaptured: true` — the
  service immediately captures, so an order can be paid end-to-end locally. No external calls.
- **Tabby / Tamara** adapters: structured shells implementing the contract; **fail closed**
  (`PaymentNotConfiguredError`) unless their `*_API_KEY` / `*_WEBHOOK_SECRET` env is set. Real
  hosted-checkout + HMAC webhook verification is the credentialed follow-up.
- **Moyasar**: stub shell (direct-gateway placeholder, per ADR-0002).

### Flow
- `POST /lahtha/orders/:id/pay` (buyer; `lahtha.order.place`): the buyer must own the order and it
  must be `PENDING_PAYMENT`. The service picks the configured adapter, `createIntent`, records a
  `payment` row (`paymentRef = intentId`). If `autoCaptured` (stub) → immediately
  `applyPaymentResult(captured)` and return the updated order; otherwise return `{ redirectUrl }`.
- `POST /lahtha/payments/webhook/:provider` (public; **HMAC-verified** per adapter): map to
  `applyPaymentResult(captured|failed)`. Idempotent (checkout already dedupes by `paymentRef`).

### Money
No new money math — `subtotal/commission/total` already live on the order (ADR-0004). The payment
captures `order.totalHalalat`.

### Wiring (no cycle)
`payment` depends on checkout via a `CheckoutPaymentPort` (`getOrder`, `applyPaymentResult`);
`app.ts` builds the payment service over the checkout service and the configured adapter.

## Config
`PAYMENT_PROVIDER` (default `stub` in non-prod), `TABBY_API_KEY`/`TABBY_WEBHOOK_SECRET`,
`TAMARA_*`, `MOYASAR_*` (all optional; absence → that adapter is unavailable).

## Consequences
- **Positive**: orders become payable; the storefront completes in dev via the stub; real BNPL
  slots in by adding credentials (no checkout changes — ADR-0004's seam holds).
- **Negative / trade-offs**: the stub auto-captures (no real authorization) — dev/demo only,
  never enabled in production. Webhook signature verification for real providers is implemented
  per-adapter but only exercised once credentialed. No partial-capture/auth-then-capture (BNPL
  settles in one shot, per ADR-0002).
- **Data**: new `payments` collection (`paymentId`/`intentId` unique, `orderId` index).

## Test plan
- Stub: `pay` an order → auto-captures → order leaves `PENDING_PAYMENT` (digital → IN_CUSTODY,
  physical → AWAITING_FULFILLMENT); buyer-not-owner → 403; non-pending order → rejected.
- Webhook: a `captured` event drives the order to paid; `failed` → `PAYMENT_FAILED`; replay is
  idempotent.
- Adapter shells: Tabby/Tamara/Moyasar throw `PaymentNotConfiguredError` without creds.

## Out of scope (follow-ups)
Real Tabby/Tamara hosted-checkout + live webhooks (credentials); the storefront "Pay" button
(separate web PR); settlement/reconciliation jobs.
