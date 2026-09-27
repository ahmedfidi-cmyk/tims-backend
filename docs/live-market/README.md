# LIVE MARKET — product workstream

Consulting deliverables for the **LIVE MARKET** project: a global 24/7 marketplace built exclusively on live
streaming as the medium for advertising, showcasing, and commercial interaction. All work here sits on the
**approved baseline dated 27 September 2026** and does not re-open it.

## Documents

| Document | Purpose | Status |
|---|---|---|
| [mvp-scope-decision-matrix.md](./mvp-scope-decision-matrix.md) | Closes MVP scope: scored decision matrix, P0/P1 cut line, Phase 2/3 with pull-forward triggers, cold-start plan, delivery-cost model, app-store and regulatory assumption registers, 2 Change Requests | Recommendation — awaiting owner sign-off |

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

## Candidate next deliverables

1. Package structure and pricing tiers — must use *concurrency ceiling* as a tier variable (see §6.3 of the matrix).
2. WebRTC vs. LL-HLS comparison with latency and cost targets — the matrix carries only a directional assumption (§13).
3. Seller-journey PRD covering the Go-Live flow and the no-grace-period session lifecycle.
4. Boost mechanics: Qualified View definition and frequency caps.
