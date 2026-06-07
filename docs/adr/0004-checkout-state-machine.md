# ADR-0004 — Checkout: Dual-Path Order State Machine (Workstream 4)

| | |
|---|---|
| **Status** | Proposed |
| **Date** | 2026-06-07 |
| **Decision owners** | Engineering + Owner |
| **Relates to** | [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) §3.3 (Checkout State Machine), [`imei-inventory-schema.md`](../architecture/imei-inventory-schema.md) (ownership), [`../product/commission-policy.md`](../product/commission-policy.md) |
| **Builds on** | IAM session authz (ADR for the bridge) + W3 inventory ownership transfer |
| **Decisions locked with owner** | Buyer auth = generalize identity to customers; order targets a device directly; money = subtotal + commission, **no VAT yet** |

## Context

ARCHITECTURE.md §3.3 calls for a **dual-path checkout**: a purchase routes to either **physical fulfillment** (shipping logic) or **digital custody** (the "ممتلكاتي" digital-custody agreement — instant, no shipment). W4's acceptance bar: *a customer can place an order; the order advances on a payment event.*

Three forks were resolved with the owner before this ADR:
1. **Buyer authentication** — generalize the existing OTP identity onboarding to issue a **customer** principal (not vendor-only), so buyers self-register, get a session, and place orders through the same flow.
2. **Order target** — an order references **a device directly** (no separate `Listing` entity yet).
3. **Money** — compute **subtotal + commission** only; **VAT/ZATCA deferred** to W6.

Payments themselves are W5 (ADR-0002: BNPL-first). W4 must therefore model the order lifecycle and the **seam** a payment provider drives, without wiring a real provider.

## Decision

A new domain `src/domains/lahtha/checkout/`, same pure-core + ports/adapters shape as `vendor/`, `inventory/`, `iam/`.

### 1. Buyer auth — generalize identity onboarding

- Registration accepts an optional `principalType` (`vendor` | `customer`, default `vendor` for backward compatibility); the provisioner creates the matching RBAC principal. Customers self-register + verify OTP exactly like vendors and receive a session bound to their `userId`.
- Placing an order is gated by `lahtha.order.place` (held by `customer.standard`), resolved from the **session principal** (the buyer), via the shared IAM `authz`.

### 2. Sale price on the device (no Listing entity)

To keep "order targets a device directly" while still having a price:
- A vendor sets a **sale price** on a device they own (`PATCH /lahtha/inventory/devices/:id/sale-price`, gated by `lahtha.vendor.manage_profile`). A device is **purchasable** when it has a sale price AND is currently vendor-owned.
- The order **snapshots** `subtotalHalalat` from the device's sale price at creation — the order is immune to later price changes.

> This is a deliberately thin stand-in for listings; a full `Listing` (multiple offers, visibility, expiry) remains a later option if the catalog needs it.

### 3. Order entity & money (integer halalat, decimal-safe)

```
order {
  orderId, buyerUserId, deviceId, vendorUserId,
  fulfillmentType: 'physical_fulfillment' | 'digital_custody',
  status, subtotalHalalat, commissionHalalat, vendorNetHalalat, totalHalalat,
  paymentRef|null, shippingRef|null, idempotencyKey|null,
  createdAt, updatedAt
}
```
- `subtotalHalalat` = device sale price (what the buyer pays). **`totalHalalat == subtotalHalalat`** in W4 (no VAT).
- `commissionHalalat` = `computeCommissionHalalat(subtotal, 'lahzaPrimarySale')` (existing `commission.ts`, 5% ceiling) — the platform fee deducted from the vendor's settlement.
- `vendorNetHalalat` = `subtotal − commission`. All integer math; no floats (NFR).

### 4. Dual-path state machine (pure core)

```
                         ┌─ physical_fulfillment ─→ AWAITING_FULFILLMENT ─→ SHIPPED ─→ DELIVERED ─→ COMPLETED
PENDING_PAYMENT ─paid──→ PAID ─┤
       │                       └─ digital_custody ─────→ IN_CUSTODY ───────────────────────────────→ COMPLETED
       ├─ payment_failed ─→ PAYMENT_FAILED (terminal)
       └─ cancel ────────→ CANCELLED (terminal)
PAID / COMPLETED ─refund─→ REFUNDED (terminal, admin)
```

- Transition table is the single source of truth; illegal transitions → `409` (same discipline as vendor approval).
- The **path** is fixed at creation (`fulfillmentType`); `applyPaymentResult` branches `PAID → AWAITING_FULFILLMENT` vs `PAID → IN_CUSTODY`.

### 5. Inventory coupling (in-process port, not sync_events)

Checkout ↔ inventory are **both LAHTHA** (same DB), so ownership transfer is a direct call through an injected `InventoryPort` (wrapping the W3 `InventoryService.transferOwnership`), not the `sync_events` bus (that bus is for **LAHTHA ↔ CLICK**).

- `digital_custody`: on `PAID → IN_CUSTODY`, transfer device → `lahtha_custody` (`acquisitionType: 'purchase'`, `sourceEventId = orderId`).
- `physical_fulfillment`: on `DELIVERED → COMPLETED`, transfer device → `customer`.
- A guard at **order creation** verifies the device is vendor-owned and priced (reserve-on-create is a later refinement; for W4 the ownership transfer happens at the state transition above).

### 6. Payment as a seam (W5 plugs in)

- The service exposes `applyPaymentResult(orderId, { outcome: 'captured'|'failed', paymentRef })`, **idempotent** by `paymentRef`. W5's webhook receiver will call it.
- For W4 an admin-gated endpoint `POST /lahtha/orders/:id/payment-event` (`lahtha.state.override`) drives it so the flow is testable end-to-end without a provider — mirroring the Entra/S3 "wired seam" approach.

### 7. Endpoints & authorization

| Method & path | Permission / rule |
|---|---|
| `POST /lahtha/orders` (place; body: deviceId, fulfillmentType, idempotencyKey?) | `lahtha.order.place` (buyer session) |
| `GET /lahtha/orders/:id` | session; requester must be buyer, selling vendor, or admin (`platform.read_all`) |
| `GET /lahtha/orders?role=buyer\|vendor` | session; lists the caller's orders |
| `POST /lahtha/orders/:id/payment-event` | `lahtha.state.override` (W5 seam) |
| `POST /lahtha/orders/:id/ship` / `/deliver` | `lahtha.state.override` (vendor-driven fulfillment is a later refinement) |
| `POST /lahtha/orders/:id/cancel` | buyer (while `PENDING_PAYMENT`) or admin |
| `POST /lahtha/orders/:id/refund` | `lahtha.order.refund` (admin.ops); reverses commission via `computeRefundCommissionReversalHalalat` |

### 8. Idempotency & concurrency

- Order placement accepts an optional `idempotencyKey` (unique per buyer) — a retry returns the existing order rather than creating a duplicate.
- State writes use the same atomic compare-and-set on `status` as vendor approval, so concurrent transitions can't double-apply.

## Collections & indexes
- **`orders`** — unique `orderId`; unique `(buyerUserId, idempotencyKey)` sparse; index `(buyerUserId, createdAt)`, `(vendorUserId, createdAt)`, `(deviceId)`.
- Device gains `salePriceHalalat` (nullable) — no new collection.
- Migration `*-checkout.cjs`.

## Consequences

### Positive
- Delivers the dual-path lifecycle and the payment seam W5 needs, with correct integer money math reusing `commission.ts`.
- Generalizing identity unlocks real customer sessions — the platform becomes usable buyer-end.
- Reuses W3 ownership transfer; no new cross-domain bus needed.

### Negative / trade-offs
- No VAT yet — totals are pre-tax; W6 (ZATCA) adds VAT to the breakdown. Acceptable per owner decision.
- Sale-price-on-device is a thin listing substitute; revisit if multi-offer listings are needed.
- Vendor-driven fulfillment (vendor marks shipped) is deferred — W4 routes fulfillment transitions through ops to keep the surface small.
- No payment reservation/hold at creation; a device could in principle receive two pending orders. Mitigation: the ownership transfer (single-current-owner index) makes only one completion possible; a reserve-on-create refinement can come with W5.

### Migration
- `*-checkout.cjs` creates `orders` with indexes and is additive; `salePriceHalalat` is schemaless-add on `devices`.

## Test plan (~40, no live DB)
- Pure: state-machine transitions (all legal + rejected), money breakdown (subtotal/commission/net), idempotency key behavior.
- Service: place (priced + vendor-owned guard), pay→branch per path, digital custody ownership transfer, physical ship→deliver→complete + transfer, cancel, refund + commission reversal.
- HTTP: permission gating via session principal (buyer places; non-buyer 403; admin drives payment/fulfillment); buyer/vendor/admin read visibility.
- IAM: customer registration + login issues a `customer`-principal session.

## Open questions (non-blocking; default chosen)
1. **Reserve-on-create** vs transfer-on-complete only — default: transfer-on-complete (revisit with W5).
2. **Vendor-driven fulfillment** (vendor marks shipped) — default: ops-driven in W4, vendor self-service later.
