# LIVE MARKET — Seller Journey PRD

| | |
|---|---|
| **Document type** | Product Requirements Document |
| **Baseline** | LIVE MARKET approved baseline, 27 September 2026 |
| **Date** | 2026-09-27 |
| **Prepared by** | Senior Product Consultant & Solution Architect |
| **Status** | Recommendation — buildable for MVP P0/P1 once CR-01, CR-02 and `T_reconnect` are decided |
| **Scope** | Seller side, end to end: account → legal status → package → Go-Live → live session → session end → aftermath → renewal |
| **Out of scope** | Viewer/buyer journey · Discovery UX · admin & moderation consoles · Boost · Phase-2 seats and invoicing |
| **Depends on** | [Scope matrix](./mvp-scope-decision-matrix.md) · [Streaming architecture](./streaming-architecture-webrtc-vs-llhls.md) · [Packages & pricing](./package-structure-and-pricing.md) |

> **Tag legend** — **[Approved]** baseline · **[Open]** baseline-declared open question · **[Deferred]** outside the
> baseline's design surface · **[My Recommendation]** consultant judgement, rejectable without touching the baseline.
>
> **Standing caveat.** Identity, tax, consumer-law and app-store statements are assumptions requiring specialised
> per-country validation. Nothing here is legal advice.

---

## 1. Who the seller is

The baseline spans "an individual seller with a phone" to "an international company with a master account, multiple
broadcaster seats, and concurrent streams across countries". All four legal statuses exist from day one; what varies
at MVP is capacity, not membership.

| Legal status [Approved] | MVP identity requirement | MVP capacity | Notes |
|---|---|---|---|
| **Individual** | Phone/email verification + verified payment instrument | 1 seat, 1 concurrent stream | No document KYC at MVP, because the platform takes no buyer payment (matrix F3 → Phase 2) |
| **Business** | Document upload + manual review (matrix A3) | 1 seat, 1 stream | Trader identification duty — matrix R1 |
| **Company** | Document upload + manual review | 1 seat, 1 stream | Seats arrive with A5 |
| **International** | Document upload + manual review | 1 seat, 1 stream | Multi-country concurrency arrives with A6 |

**Status is displayed, never scored.** [Approved] Principle 12 — there is no "Verified" mark, no badge, no trust
score, and legal status confers **no ranking advantage** (Principle 6). Status is a disclosure, and it must read as
one.

**The org model ships as schema at MVP** (matrix A4): an account may own N broadcaster identities even though the UI
exposes exactly one. Retrofitting this after launch touches auth, billing, entitlements and analytics at once.

---

## 2. Journey map

| # | Stage | Surface | MVP tier |
|---|---|---|---|
| S1 | Understand the offer and decide | **Web** | P0 |
| S2 | Create account | Web or app | P0 |
| S3 | Declare legal status (+ KYC tier-1 where required) | Web | P0 |
| S4 | Buy a package | **Web only** (CR-02) | P0 |
| S5 | Prepare — profile, category, optional Scheduled Live | Web or app | P0 / S5b is P1 |
| S6 | Go-Live pre-flight | **App** | P0 |
| S7 | Live session | **App** | P0 |
| S8 | Session end | App | P0 |
| S9 | Aftermath — statistics, lead handoff | Web | P1 |
| S10 | Renew or lapse | Web | P0 |

**Surface split** [My Recommendation], forced by matrix CR-02: **the app never sells.** It carries Go-Live, the live
session, chat moderation and notifications. Purchase, KYC, statistics and lead export live on web. The app must
contain **no purchase button and no external purchase link** — it shows entitlement state and, when exhausted, a
non-linking instruction to complete the purchase on the web account.

---

## 3. Stage specifications

### S1 — Understand the offer and decide · Web · P0

**Goal.** A prospective seller understands that this is a live-only market with paid broadcasting, and can predict
what they will get, before paying.

| Requirement | Detail |
|---|---|
| S1.1 | The live-only model is stated plainly: no store, no catalogue, no replay, the broadcast **is** the ad, and leaving the stream ends it |
| S1.2 | Package comparison showing both allowances — **broadcast hours and viewer-hours** — plus overage rates, in one table |
| S1.3 | A worked example: "40 hours with an average of 40 viewers = 1,600 viewer-hours = within Growth" |
| S1.4 | Commerce modes explained as **optional and free to choose** — never as tier features (Principle 8) |
| S1.5 | Explicit statement that ranking is organic and **cannot be bought** (Principle 6), and that AI is free on every tier (Principle 4) |
| S1.6 | No ROI or earnings claims. A marketplace that promises income attracts the sellers Principle 2 is designed to filter out |

**Acceptance.** A first-time visitor can state, unprompted, (a) that they must be live to sell, (b) what happens when
they leave, and (c) what they will be charged if their audience exceeds the allowance.

### S2 — Create account · P0

| Requirement | Detail |
|---|---|
| S2.1 | Phone or email OTP; session management; recovery path (matrix A1) |
| S2.2 | Account is created against an **org record** even for an individual (matrix A4 schema) |
| S2.3 | Locale and interface language chosen at signup; RTL correct where applicable (matrix I4) |
| S2.4 | **Declared interest categories** captured here — this is the MVP Interest Match input (matrix D2), and it is the seller's category, not behavioural inference |

### S3 — Legal status and identity · Web · P0

| Requirement | Detail |
|---|---|
| S3.1 | Seller selects one of the four statuses; the consequences of each are stated before selection |
| S3.2 | Individual: no document upload at MVP |
| S3.3 | Business / Company / International: upload registration document; state is `pending_review` |
| S3.4 | `pending_review` **does not block** Go-Live at MVP for Exposure Only; it blocks display of the elevated status, which shows as `Individual` until reviewed — **[Open], see §10.1** |
| S3.5 | Review decision stored as decision + reviewer + timestamp + expiry. **Recommend not retaining the document itself** (matrix §7) — subject to per-country validation |
| S3.6 | Status changes are audit-logged and re-reviewable |
| S3.7 | **No badge, tick, shield, colour-coded trust cue, or ordering effect** anywhere the status appears |

### S4 — Buy a package · Web only · P0

| Requirement | Detail |
|---|---|
| S4.1 | One globally unified sticker price per tier, net of tax; tax shown as a separate statutory line (pricing §7) |
| S4.2 | Local-currency display at the published monthly FX peg, with the reference price visible |
| S4.3 | Prepaid, non-recurring, 30-day validity; **no auto-renew at MVP** and no dark-pattern pre-ticked renewal |
| S4.4 | Both allowances confirmed on the receipt: broadcast hours and viewer-hours |
| S4.5 | Overage rates and the **seller-set spend ceiling** are presented at purchase, with the ceiling **on by default** |
| S4.6 | Refund policy linked and readable before payment (matrix C7) |
| S4.7 | Trial Pass purchasable once per account, ever; the constraint is stated before purchase |
| S4.8 | Entitlement is active immediately on payment confirmation |

### S5 — Prepare · P0 (S5b is P1)

**S5a — Broadcaster profile.** The highest-risk screen in the product, because it is where a live-only market grows a
catalogue if nobody is watching.

| Requirement | Detail |
|---|---|
| S5a.1 | Profile contains: display name, legal status, declared categories, region, **live-now state**, and upcoming scheduled sessions |
| S5a.2 | Profile contains **no** product list, no prices, no photo gallery of goods, no past-session archive, no follower count, no ratings, no reviews |
| S5a.3 | A short free-text description is permitted, moderated, and **length-capped** (recommend 300 characters) so it cannot become a product listing |
| S5a.4 | When the seller is offline the profile says so and offers only the schedule and Notify-me — **never a browsable substitute for the live session** |

**S5b — Scheduled Live + Notify-me · P1** (matrix B5, with its three guardrails)

| Requirement | Detail |
|---|---|
| S5b.1 | Schedule card carries category, legal status, title, region, start time — **nothing else** |
| S5b.2 | Card expires when the session ends or the slot lapses; it never becomes a persistent record |
| S5b.3 | Scheduling confers **no ranking advantage** (Principle 6) |
| S5b.4 | Viewers may set Notify-me; the seller sees only an aggregate count, never viewer identities (Principle 7) |
| S5b.5 | A lapsed schedule is recorded against the seller's reliability internally, is **not** displayed publicly, and is **not** a ranking signal |

### S6 — Go-Live pre-flight · App · P0

The single most important screen for cost, quality and compliance. Nothing here is optional.

| # | Check | Behaviour on failure |
|---|---|---|
| S6.1 | Active package with remaining broadcast hours | Block; explain; direct to the web account **without a link** (CR-02) |
| S6.2 | **Remaining hours and remaining viewer-hours displayed** before commitment | — |
| S6.3 | Category selection (drives Interest Match and the Policy Engine) | Required |
| S6.4 | **Target markets** selection | Policy Engine evaluates; **non-compliant regions are removed and the removal is explained** — the session is never rejected (matrix D7, Principle 11) |
| S6.5 | Commerce mode: Exposure Only or Lead Generation | Free choice, never tier-gated (Principle 8) |
| S6.6 | Sensitive-content self-declaration | Drives the viewer-side notice and age gate (Principle 10) |
| S6.7 | Device pre-flight: camera, microphone, **uplink throughput test** | Warn below the 360p floor; allow the seller to proceed informed |
| S6.8 | Concurrency check (MVP: 1) | Block the second stream, name the limit |
| S6.9 | Estimated cost preview at the seller's typical audience | Advisory, not a commitment |

**Acceptance.** A seller cannot reach the live state without a resolved category, at least one permitted target
market, a chosen commerce mode, and a passed device check.

### S7 — The live session · App · P0

| Requirement | Detail |
|---|---|
| S7.1 | Ingest via WHIP/WebRTC; viewers served LL-HLS; identical ABR ladder for every tier (streaming §5, pricing §1) |
| S7.2 | Seller sees: elapsed time, **remaining hours**, **remaining viewer-hours**, current viewers, connection health |
| S7.3 | Viewers see a **coarse audience band** ("50+ watching") rather than an exact count — [My Recommendation] §10.2 |
| S7.4 | Live text chat with seller controls: mute participant, eject, slow mode, word filter, disable chat (matrix E1) |
| S7.5 | **Contact Request** available to viewers for the entire live session and **only** during it (Principle 9) |
| S7.6 | Seller sees Contact Requests arriving in-session, with a minimal payload and no viewer profile to browse |
| S7.7 | Broadcast-hour metering on **ingest-present time only**, 10-minute minimum per session (pricing §5) |
| S7.8 | Viewer-hour metering continuous; crossing into overage **notifies the seller and never throttles or refuses a viewer** (pricing §10) |
| S7.9 | Warnings at 80% and 95% of each allowance, in-session and by push |
| S7.10 | **No likes, no reactions, no gifts, no tips, no viewer-to-seller transfer of any kind** (Principle 3) |
| S7.11 | Automated moderation runs continuously; a high-confidence violation can terminate the session (matrix G2) |
| S7.12 | Report control available to every viewer at all times (matrix G1) |

### S8 — Session end · P0

Four distinct endings. Conflating them is the most likely source of seller distrust in the whole product.

| # | Ending | Discovery removal | Session record | Hours consumed | Seller message |
|---|---|---|---|---|---|
| 1 | **Seller ends deliberately** | Immediate (<2 s) | Closed | Yes, to the minute (10-min minimum) | Summary + statistics |
| 2 | **Ingest lost, returns ≤ `T_reconnect`** | Immediate (<2 s) — invisible and undiscoverable for the whole window | Held, then resumed with the same id | **Not for the gap** — ingest-time billing | "Reconnecting — your broadcast is not visible" |
| 3 | **Ingest lost, exceeds `T_reconnect`** | Already removed | Terminated | Only ingest-present time | "Your session ended because the connection was lost" |
| 4 | **Allowance exhausted / spend ceiling reached** | Immediate | Closed | Yes | Pre-announced at 95%, then a graceful end — explicitly **not** the Principle 1 hard stop |
| 5 | **Moderation termination** | Immediate | Terminated | Yes, unless the decision is later reversed (pricing §9) | Reason + appeal path |

**Design rule.** Endings 1 and 3 must read as "you left". Ending 4 must read as "your package ran out". A seller who
cannot tell these apart will conclude the platform cut them off arbitrarily.

### S9 — Aftermath · Web · P1

| Requirement | Detail |
|---|---|
| S9.1 | Aggregated statistics only: unique viewers, retention curve, region buckets, Contact Requests created, watch time (matrix H1) |
| S9.2 | **No per-viewer rows, no viewer identities, no exportable audience list** (Principle 7) |
| S9.3 | Contact Requests visible and exportable **once**, within the retention window (recommend ≤30 days), then auto-purged (matrix H2) |
| S9.4 | The purge is visible to the seller in advance — a countdown, not a surprise deletion |
| S9.5 | No video artefact exists to review. The statistics **are** the record (matrix H3) |
| S9.6 | Statistics are identical on every tier (pricing §1) |

### S10 — Renew or lapse · Web · P0

| Requirement | Detail |
|---|---|
| S10.1 | Expiry notice at 3 days and at expiry; unused hours expire with the package at MVP (no rollover) |
| S10.2 | Lapse is honest: the seller cannot go live, the profile shows offline, **nothing of theirs remains browsable** |
| S10.3 | Repurchase restores capacity immediately; no history is lost beyond the stated retention windows |
| S10.4 | No retention dark patterns — no fake scarcity, no hidden cancellation, no pre-ticked anything |

---

## 4. Live-session state machine

```
                 ┌──────────┐
                 │  IDLE    │
                 └────┬─────┘
                      │ pre-flight passed (S6)
                      ▼
                ┌───────────┐  ingest present
                │ CONNECTING├──────────────────┐
                └────┬──────┘                  ▼
                     │ timeout           ┌───────────┐
                     ▼                   │   LIVE    │◄────────┐
               ┌──────────┐              └─────┬─────┘         │
               │  FAILED  │        ingest lost │               │ ingest returns
               └──────────┘                    ▼               │ (t ≤ T_reconnect)
                                        ┌──────────────┐       │
      removed from discovery <2s ───────│ RECONNECTING │───────┘
      (invisible for the whole window)  └──────┬───────┘
                                               │ t > T_reconnect
                                               ▼
                                        ┌─────────────┐
                                        │  ENDED      │
                                        └─────────────┘
```

Additional transitions into `ENDED`: seller action · allowance exhausted · spend ceiling reached · moderation
termination · admin kill.

**Invariants — every one of these is testable:**

| # | Invariant |
|---|---|
| I1 | In `RECONNECTING`, the broadcast appears on **no** discovery surface and accepts **no** new Contact Request |
| I2 | Broadcast-hour metering advances **only** in `LIVE` |
| I3 | A Contact Request can be created **only** in `LIVE` |
| I4 | No state permits a viewer to be refused for an allowance reason |
| I5 | `ENDED` is terminal; resuming requires a new pre-flight and a new session id |
| I6 | No state produces a stored video artefact |

---

## 5. Contact Request lifecycle

| Phase | Rule |
|---|---|
| Creation | Only while the session is `LIVE` (Principle 9) |
| Payload | Minimum viable: the viewer's chosen contact channel, an optional short message, the session and category. **No profile, no browsing history, no inferred attributes** |
| Seller access | In-session and via the web account within the retention window |
| Export | Once, within the window, in a documented format |
| Purge | Automatic at the retention ceiling, with an audit record of the purge (matrix H2) |
| After session end | The control disappears for viewers; the seller keeps existing requests until purge |
| Never | No CRM, no re-marketing surface, no lead resale, no cross-session identity stitching |

**Design tension, stated openly.** The 30-day ceiling will frustrate sellers with long sales cycles. That is the
intended cost of Principle 7, and the honest answer to the seller is that the platform is not their CRM — the export
is. Hiding this until the purge fires would be the failure mode.

---

## 6. Edge cases

| # | Case | Required behaviour |
|---|---|---|
| E1 | Seller goes live with 5 minutes remaining | Pre-flight warns explicitly; session permitted; graceful end at exhaustion |
| E2 | Package validity expires mid-session | Session continues to the end of its metered hours; no mid-session termination for a calendar boundary [My Recommendation] |
| E3 | Viewer-hours exhausted, spend ceiling not reached | Continue, bill overage, notify seller |
| E4 | Spend ceiling reached mid-session | Graceful end with clear cause (S8 ending 4) |
| E5 | App backgrounded on iOS (camera capture stops) | Treated as ingest loss → `RECONNECTING`; aligns with Principle 1 by design |
| E6 | Two devices attempt ingest on one seat | Second is refused with a clear reason; the first is never interrupted |
| E7 | Policy Engine removes **every** selected market | Block Go-Live, explain which rule applied per region, offer permitted alternatives — still never "campaign rejected" |
| E8 | Account suspended mid-session | Immediate termination; hours credited only if the suspension is later reversed |
| E9 | Contact Request created 2 seconds before session end | Valid and retained |
| E10 | Viewer attempts contact after end | Unavailable; the surface states the seller is offline (Principle 9) |
| E11 | Seller's uplink supports only audio | Permitted at MVP with a warning; the audio-only rung is Phase 2 (matrix B4) |
| E12 | Payment succeeds, entitlement provisioning fails | Entitlement is reconciled automatically; the seller is never told to pay again |
| E13 | Refund issued on an unused package | Entitlement revoked, audit-logged |
| E14 | Seller changes legal status while live | Change takes effect at session end; status never changes mid-broadcast |

---

## 7. Notifications

| Trigger | Channel | Timing |
|---|---|---|
| Scheduled session reminder | Push + email | 60 min and 10 min before |
| Allowance at 80% / 95% | In-session + push | On crossing |
| Entered overage | In-session + push | Immediately |
| Spend ceiling reached | In-session + push | Immediately, with the session end pre-announced |
| Session ended | Push | Immediately, **with the reason** |
| Contact Request received | Push | Immediately, throttled |
| Lead purge approaching | Email | 7 days and 1 day before |
| Package expiring | Email | 3 days before, and at expiry |
| KYC decision | Email | On decision |
| Moderation action | Email + in-app | Immediately, with the appeal path |

---

## 8. Negative acceptance criteria

These belong in CI, enforcing matrix launch gate #5. A principle enforced only by intention erodes silently.

| # | Assertion |
|---|---|
| N1 | No endpoint returns stored video for a past session |
| N2 | No like, reaction, gift, tip, or viewer→seller transfer endpoint exists |
| N3 | No public follower count, reaction counter, or seller leaderboard is rendered |
| N4 | No "Verified" affordance exists; legal status has no badge and no ordering effect |
| N5 | The ranking module cannot read the commerce, package, or billing tables |
| N6 | Contact Request creation returns an error for any session not in `LIVE` |
| N7 | Lead payload purge job runs, and its audit record exists |
| N8 | The seller profile endpoint returns no product, price, or inventory field |
| N9 | Package tier does not appear in any ranking, discovery, or ABR-ladder code path |
| N10 | The mobile app bundle contains no purchase flow and no external purchase URL |
| N11 | No viewer is ever refused a live stream for a seller-allowance reason |

---

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Latency | Glass-to-glass p75 ≤ 4 s, p95 ≤ 6 s (streaming §9) |
| Go-Live time | Pre-flight to first frame ≤ 10 s p75 |
| Metering accuracy | Broadcast minutes within ±5 s of ingest-present time; viewer-hours within ±2% |
| Availability | Ingest and playback 99.5% monthly at MVP |
| Accessibility | Keyboard-navigable web; screen-reader labels; live captions unscoped at MVP (matrix R12) |
| Localisation | AR/EN with correct RTL where the beachhead requires it (matrix I4) |
| Data | No video at rest; lead payloads under the retention ceiling; aggregated statistics only |

---

## 10. Open questions

### 10.1 Does `pending_review` block anything?

S3.4 proposes that a pending Business/Company/International review does **not** block Go-Live — the seller simply
displays as `Individual` until reviewed. The alternative is to block until reviewed.

| Option | Trade |
|---|---|
| **Don't block** [My Recommendation] | Faster activation, better cold-start supply; risk that trader-identification duties (matrix R1) attach from the first commercial broadcast rather than from review |
| Block | Cleaner compliance posture; adds a manual-review queue to the critical path of every business seller's first session |

**Blocked on counsel** (R1), not on product preference.

### 10.2 Exact viewer count, or a coarse band?

S7.3 proposes viewers see "50+ watching" rather than "53 watching", while the seller always sees the exact figure.
The reasoning is that a precise public counter is the seed of a popularity contest, and Principle 3 removes the
fame economy deliberately. The counter-argument is that coarse bands read as evasive and reduce social proof that
genuinely helps a live market. **Owner's call — it is a values question, not a technical one.**

### 10.3 Still open elsewhere

| # | Item | Owner |
|---|---|---|
| 1 | `T_reconnect` final value (streaming §13.1) | Owner |
| 2 | CR-01 — moderation evidence buffer, which S8 ending 5 and any appeal depend on | Owner |
| 3 | CR-02 — the no-purchase-in-app constraint this PRD is built around | Owner |
| 4 | Lead retention ceiling — 30 days recommended | Counsel |
| 5 | Whether Individual sellers need document KYC before Phase-2 invoicing | Counsel |
| 6 | AI boundaries during a live session — blocks any in-session AI surface (matrix I5) | Owner + counsel |

---

## 11. Definition of done

| Stage | Done when |
|---|---|
| S1–S2 | A new seller reaches a purchasable state in under 3 minutes, having understood the live-only model |
| S3 | All four statuses selectable; review queue operating; no badge anywhere |
| S4 | Purchase completes on web; entitlement active immediately; spend ceiling on by default |
| S5 | Profile passes N8; Scheduled Live passes its three guardrails |
| S6 | No path to `LIVE` bypasses any of S6.1–S6.8; region removal never rejects a session |
| S7 | Metering accurate to the NFR; chat controls functional; N2, N3, N10, N11 pass |
| S8 | All five endings distinguishable in the UI and in the audit log; invariants I1–I6 pass |
| S9 | Statistics aggregated-only; export-once works; purge job verified with an audit record |
| S10 | Expiry, lapse and repurchase behave as specified; no dark patterns |
