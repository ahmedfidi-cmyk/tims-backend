# LIVE MARKET — product workstream

Consulting deliverables for the **LIVE MARKET** project: a global 24/7 marketplace built exclusively on live
streaming as the medium for advertising, showcasing, and commercial interaction. All work here sits on the
**approved baseline dated 27 September 2026** and does not re-open it.

## Documents

| Document | Purpose | Status |
|---|---|---|
| [mvp-scope-decision-matrix.md](./mvp-scope-decision-matrix.md) | Closes MVP scope: scored decision matrix, P0/P1 cut line, Phase 2/3 with pull-forward triggers, cold-start plan, delivery-cost model, app-store and regulatory assumption registers, 2 Change Requests | Recommendation — awaiting owner sign-off |
| [streaming-architecture-webrtc-vs-llhls.md](./streaming-architecture-webrtc-vs-llhls.md) | Closes the MVP streaming architecture: WebRTC vs. LL-HLS with a cost-crossover analysis, latency budget, low-connectivity ladder, ingest resilience and the transport definition of "no grace period". **Amends §13 of the scope matrix** | Recommendation — pending a 2-week measured PoC |

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

## Candidate next deliverables

1. **Package structure and pricing tiers** — now unblocked: the streaming document supplies the delivery-cost shape (`F_h + v_h × V`) that the price floor depends on. Tier variables must include *concurrency ceiling*, and short-session cost leakage must be closed.
2. **Seller-journey PRD** covering the Go-Live flow and the session lifecycle, including the `T_reconnect` semantics.
3. **Boost mechanics**: Qualified View definition and frequency caps.
4. **Infrastructure ADR** — separation of the LIVE MARKET control plane and media plane from the existing LAHTHA & CLICK deployment.

## Done

- MVP scope (matrix) — merged in [#49](https://github.com/ahmedfidi-cmyk/tims-backend/pull/49)
- Streaming architecture: WebRTC vs. LL-HLS
