# LIVE MARKET — product workstream

Consulting deliverables for the **LIVE MARKET** project: a global 24/7 marketplace built exclusively on live
streaming as the medium for advertising, showcasing, and commercial interaction. All work here sits on the
**approved baseline dated 27 September 2026** and does not re-open it.

## Documents

| Document | Purpose | Status |
|---|---|---|
| [mvp-scope-decision-matrix.md](./mvp-scope-decision-matrix.md) | Closes MVP scope: scored decision matrix, P0/P1 cut line, Phase 2/3 with pull-forward triggers, cold-start plan, delivery-cost model, app-store and regulatory assumption registers, 2 Change Requests | Recommendation — awaiting owner sign-off |
| [streaming-architecture-webrtc-vs-llhls.md](./streaming-architecture-webrtc-vs-llhls.md) | Closes the MVP streaming architecture: WebRTC vs. LL-HLS with a cost-crossover analysis, latency budget, low-connectivity ladder, ingest resilience and the transport definition of "no grace period". **Amends §13 of the scope matrix** | Recommendation — pending a 2-week measured PoC |
| [package-structure-and-pricing.md](./package-structure-and-pricing.md) | Closes package design: what may and may not differentiate a tier, the two-dimensional entitlement model (broadcast-hours × viewer-hours), the tier ladder, price derivation from the cost floor, overage, unified-pricing mechanics and discount governance. **Amends §5 of the scope matrix** | Recommendation — price points pending PoC |
| [seller-journey-prd.md](./seller-journey-prd.md) | The seller side end to end: ten stages with acceptance criteria, the live-session state machine and its invariants, Contact Request lifecycle, 14 edge cases, notifications, and 11 CI-enforceable negative acceptance criteria | Recommendation — buildable once CR-01, CR-02 and `T_reconnect` are decided |

## Conventions

Every element in these documents is tagged:

- **[Approved]** — follows directly from the 27 Sep 2026 baseline; not re-opened.
- **[Open]** — a baseline-declared open question; the document either closes it or names who must.
- **[Deferred]** — explicitly outside the baseline's design surface; referenced only as a boundary.
- **[My Recommendation]** — consultant judgement, not baseline. Rejectable without touching the baseline.

Anything that conflicts with an approved principle is raised explicitly as a **Change Request** with justification,
impact-if-approved, and impact-if-rejected — never folded silently into a design.

Every regulatory, financial, legal, tax, and app-store statement is an **assumption requiring specialised
per-country validation**. None of it is legal advice.

## Open items blocking further deliverables

| # | Item | Blocks |
|---|---|---|
| 1 | Beachhead selection (region cluster × 3 categories) | Localisation scope, legal research scope, PSP selection, Market Hours, moderation language coverage |
| 2 | CR-01 — short-lived moderation evidence buffer | Moderation build (G2/G3) |
| 3 | CR-02 — app-store commission vs. globally unified pricing | Package purchase path (C1/C2) |
| 4 | Transaction fee vs. platform legal role | Phase-2 commerce (F3b). The 10% figure is **not approved** |
| 5 | AI boundaries during a live session | Phase-2 AI assistant (I5) |
| 6 | Transport definition of "no grace period" (`T_reconnect`) | Session lifecycle implementation (B2) |
| 7 | Media vendor selection | Blocked on the beachhead decision + the streaming PoC |
| 8 | Tax treatment of a net-of-tax global sticker price | Package pricing (§14.1) |
| 9 | Enterprise pricing as a published rate card, not negotiation | Phase-2 enterprise tiers (§14.2) |
| 10 | Whether `pending_review` blocks Go-Live for Business/Company/International | Seller onboarding (PRD §10.1) |
| 11 | Exact viewer count vs. a coarse audience band for viewers | Live session UI (PRD §10.2) |

## Candidate next deliverables

1. **Discovery UX spec** — the market grid, the honest empty state, Scheduled Live guardrails, and the viewer/buyer side of the Contact Request.
2. **Boost mechanics**: Qualified View definition and frequency caps.
3. **Infrastructure ADR** — separation of the LIVE MARKET control plane and media plane from the existing LAHTHA & CLICK deployment.
4. **Moderation operating model** — the 24/7 rota, triage SLA and appeal path that the seller PRD's session endings depend on.

## Done

- MVP scope (matrix) — merged in [#49](https://github.com/ahmedfidi-cmyk/tims-backend/pull/49)
- Streaming architecture: WebRTC vs. LL-HLS — merged in [#50](https://github.com/ahmedfidi-cmyk/tims-backend/pull/50)
- Package structure and pricing tiers
- Seller journey PRD
