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
| [moderation-operating-model.md](./moderation-operating-model.md) | Risk taxonomy, four-layer stack, automated-detection economics, 24/7 rota sizing and cost, triage SLA, tooling, appeals, QA and wellbeing. **Materially amends pricing §5 and §12** — moderation compute was missing from the serving-cost model | Recommendation — rota sizing and CR-01 both on the critical path |
| **[financial-model.md](./financial-model.md)** | **Single source of truth for every unit cost.** Parameter register, cost equations, three scenarios, sensitivity ranking, break-even, and change control. **Supersedes the cost figures in every other document — see its §9.1** | Recommendation — every parameter assumed until measured |
| [seller-retention-programme.md](./seller-retention-programme.md) | The binding constraint the financial model surfaced: metric definitions for a prepaid model, a five-mode causal model of non-repurchase, the repurchase loop, the retention tactics this baseline forbids, instrumentation, and a 90-day pilot. **Contains a scope amendment request** | Recommendation — §7 needs an accept/reject |
| [discovery-ux-spec.md](./discovery-ux-spec.md) | The viewer/buyer side: market grid as a grid rather than a feed, poster frames instead of live previews (and why), the empty state as a first-class surface, watch and chat, Contact Request, age gates, session-end states, 11 negative acceptance criteria, and the buyer-trust problem | Recommendation — one possible future CR flagged, not requested |

> **Read the financial model first for any number.** The cost model was amended three times as the workstream
> progressed, each amendment correct and documented. `financial-model.md` holds the authoritative values and lists
> every superseded figure; the other documents explain *why* a number exists.

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
| 12 | Pricing response to the moderation-compute correction — raise prices, hold and accept ~62% margin, or reduce coverage | Tier prices (moderation §13.3) |
| 13 | In-house moderation rota vs. outsourced BPO — the largest achievable lever on break-even | Launch staffing (moderation §14, financial §8) |
| 14 | Accept Phase 2 (seats) as scheduled work rather than demand-contingent — the P&L does not close without it | Roadmap (financial §4, §9.2) |
| 15 | Replace the ≥40% month-2 renewal target with ≥0.85 monthly repurchase and NRR ≥100% | Growth targets (financial §7, retention §10.1) |
| 16 | **Scope amendment**: promote Contact Request, Lead Generation, seller statistics and Scheduled Live to P0, add hour rollover to MVP, and demote the Trial Pass to Phase 2 to fund it | MVP scope (retention §7) |
| 17 | Who owns `r` — a named person, not a process | Accountability (retention §10.2) |
| 18 | Device-local saved sellers — accept or reject | Viewer UX (discovery §7.1) |
| 19 | Whether anonymous watching is acceptable given that it weakens the Unique Viewers ranking signal | Viewer UX (discovery §7.1) |
| 20 | Seller ratings/reviews — **not requested**, flagged as a future CR against Principles 12 and 6 if buyer hesitancy proves to be the conversion blocker | Buyer trust (discovery §9.3) |

## Candidate next deliverables

1. **Boost mechanics**: Qualified View definition and frequency caps (Phase 2, but the definition wants settling early).
2. **Infrastructure ADR** — separation of the LIVE MARKET control plane and media plane from the existing LAHTHA & CLICK deployment.
3. **Policy Engine rulebook scaffold** — the category × country matrix structure, ready for counsel to populate per launch market.

> Seven documents in, the pack is no longer short of analysis. The open decisions below are what the next phase needs,
> and no further deliverable unblocks them.

## Done

- MVP scope (matrix) — merged in [#49](https://github.com/ahmedfidi-cmyk/tims-backend/pull/49)
- Streaming architecture: WebRTC vs. LL-HLS — merged in [#50](https://github.com/ahmedfidi-cmyk/tims-backend/pull/50)
- Package structure and pricing tiers — merged in [#51](https://github.com/ahmedfidi-cmyk/tims-backend/pull/51)
- Seller journey PRD — merged in [#51](https://github.com/ahmedfidi-cmyk/tims-backend/pull/51)
- Moderation operating model — merged in [#52](https://github.com/ahmedfidi-cmyk/tims-backend/pull/52)
- Consolidated financial model
- Seller retention & repurchase programme
- Discovery & viewer UX specification
