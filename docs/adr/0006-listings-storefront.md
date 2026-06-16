# ADR-0006 — Listings: priced vendor offers for the customer storefront

| | |
|---|---|
| **Status** | Accepted (backend implemented; storefront UI follows) |
| **Date** | 2026-06-14 |
| **Decision owners** | Engineering + Owner |
| **Relates to** | [ADR-0004](./0004-checkout-state-machine.md) (price on the order), W3 inventory, W4 checkout |

## Context

The customer storefront needs **prices** to display and charge. ADR-0004 deliberately keeps
price **off the device** (the order carries the charged price). So there is no per-device price
to show, and customers can't set their own price at checkout. The owner chose to introduce the
**Listing** concept ADR-0004 deferred, rather than reverse that decision.

## Decision

Add a small **Listing** domain (`src/domains/lahtha/listing/`): a vendor lists a device they own
at a price; customers browse active listings; an order references a listing and **snapshots its
price**; completing the order marks the listing **sold**. Price-on-the-order (ADR-0004) is
preserved — the listing is just where the offered price comes from.

### Entity & state
```
Listing { listingId, deviceId, vendorUserId, priceHalalat, status, createdAt, updatedAt }
status: active ──sell──> sold        (terminal; set on order completion)
        active ──withdraw──> withdrawn (terminal; vendor pulls the offer)
```
- **One active listing per device** (DB partial-unique index, like one-current-owner).
- Creating a listing verifies the device is currently **vendor-owned by the lister** (via the
  inventory ownership port) and requires a positive integer `priceHalalat`.

### Endpoints (mounted at `/lahtha`)
| Method & path | Auth |
|---|---|
| `GET /lahtha/listings` | public — active listings (browse), with device summary |
| `GET /lahtha/listings/:id` | public |
| `POST /lahtha/listings` (deviceId, priceHalalat) | `lahtha.vendor.manage_profile` (vendor.owner) |
| `POST /lahtha/listings/:id/withdraw` | lister (vendor) or admin |
| `GET /lahtha/listings/mine` | session (vendor's own listings) |

### Checkout integration
- `placeOrderFromListing({ listingId, fulfillmentType }, buyerUserId)`: resolve the **active**
  listing → `deviceId`, `vendorUserId`, `priceHalalat`; reuse the existing order-placement logic
  with `subtotal = priceHalalat`; store `listingId` on the order. (The original deviceId+subtotal
  path stays for tests/back-compat.)
- On order **completion** (digital `IN_CUSTODY` / physical `COMPLETED`), checkout calls a
  `ListingSoldPort` to mark the listing `sold`. Best-effort (logged on failure), like activation.
- Self-purchase guard: a buyer can't order their own listing (already covered by checkout's
  vendor-owned + not-buyer checks).

### Wiring (no cycle)
`createInventoryService()` is built once and shared; the listing service takes an inventory
ownership port; checkout takes a `ListingSoldPort` over the listing service. All composed in
`app.ts`.

## Consequences
- **Positive**: storefront gets real prices; ADR-0004's price-on-order invariant holds; reuses
  W3 ownership + W4 checkout; one active offer per device prevents double-listing.
- **Negative / trade-offs**: another cross-domain port (checkout→listing). Mark-sold is
  best-effort (not a distributed txn) — a completed order could briefly leave a listing `active`;
  reconcilable. Withdrawing/relisting after a failed/cancelled order is a manual vendor action.
- **Data**: new `listings` collection (+ unique `listingId`, partial-unique active-per-device,
  `by_vendor`). Migration added.

## Test plan
- Pure: listing state machine (active→sold/withdrawn; illegal transitions).
- Service: create (vendor-owned guard, positive price, one-active-per-device), withdraw, markSold,
  browse/active + mine.
- Checkout: placeOrderFromListing snapshots the price + stamps listingId; completion marks the
  listing sold; placing against a non-active listing fails.

## Out of scope (next PR)
The **customer storefront UI** (browse → detail → cart → checkout) and customer onboarding/login
on the web — wired to these endpoints + W4.
