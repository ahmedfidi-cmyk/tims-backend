# LIVE MARKET — Discovery & Viewer UX Specification

| | |
|---|---|
| **Document type** | Product specification (viewer / buyer side) |
| **Baseline** | LIVE MARKET approved baseline, 27 September 2026 |
| **Date** | 2026-09-28 |
| **Prepared by** | Senior Product Consultant & Solution Architect |
| **Status** | Recommendation — contains one **possible Change Request** the owner must rule on (§9) |
| **Scope** | Everything a viewer or buyer touches: market grid, filters, empty state, schedule, watch surface, chat, Contact Request, age gate, session end, reporting |
| **Out of scope** | Seller side ([PRD](./seller-journey-prd.md)) · moderation console ([model](./moderation-operating-model.md)) · Boost surfaces (Phase 2) |
| **Depends on** | [Scope matrix](./mvp-scope-decision-matrix.md) D1–D7, E1–E2 · [Streaming](./streaming-architecture-webrtc-vs-llhls.md) · [Financial model](./financial-model.md) for the cost constraints in §8 |

> **Tag legend** — **[Approved]** baseline · **[Open]** baseline-declared open question · **[Deferred]** outside the
> baseline's design surface · **[My Recommendation]** consultant judgement, rejectable without touching the baseline.

---

## 1. The design problem, stated honestly

Strip away what the baseline forbids and ask what is actually left to browse:

| Removed | By |
|---|---|
| Permanent catalogue | Principle 1 |
| Feed / reels | Principle 1 |
| Replay / VOD | Principle 1 |
| Likes, gifts, tips, follower counts | Principle 3 |
| "Verified" badges | Principle 12 |
| Sales-based ranking or bestseller lists | Principle 6 |
| Free-text search (MVP) | Matrix D6, trigger-gated |

**What remains is: what is live right now, and what is scheduled next.** That is the entire discovery surface. It is
radically smaller than any marketplace a user has used before, and at launch it will frequently contain nothing.

Two consequences shape every decision below:

1. **The empty state is not an error condition — it is the most-visited screen of launch week.** It must be designed as a first-class surface with real content, or the market teaches viewers not to return.
2. **Every discovery pattern the industry reaches for by reflex is either forbidden or ruinously expensive here.** Infinite feed, autoplay-next, swipe-to-next-stream, multi-tile live previews — §3 and §8 rule each of them out, and for two independent reasons each time.

---

## 2. Surface inventory

| # | Surface | MVP tier | Notes |
|---|---|---|---|
| V1 | Market grid (home) | P0 | The product's front door |
| V2 | Category × geo filters | P0 | Replaces search at MVP |
| V3 | Empty state | P0 | §4 — first-class, not a fallback |
| V4 | Schedule + Remind-me | P1 | Pairs with matrix B5 |
| V5 | Watch surface | P0 | |
| V6 | Live chat | P0 | Matrix E1 |
| V7 | Contact Request | P1 | Matrix E2 — live only (Principle 9) |
| V8 | Report / block | P0 | Matrix G1, app-store gate |
| V9 | Age gate + sensitive-content notice | P0 | Principle 10 |
| V10 | Session-ended state | P0 | §6 — the hardest screen to get right |
| V11 | Viewer account (minimal) | P0 | §7 |

---

## 3. V1 — The market grid

### 3.1 It is a grid, not a feed

| Requirement | Detail |
|---|---|
| G1 | A **bounded, paginated grid** of live broadcasts. Tap a tile to enter; back returns to the grid |
| G2 | **No infinite scroll**, no autoplay-next, **no swipe-to-next-stream** | 
| G3 | Tile content: poster frame, category, seller display name, **legal status**, region, coarse audience band |
| G4 | Order is the ranking output (matrix D2). No manual curation, no editorial picks, no "featured" |
| G5 | New broadcasts receiving Discovery Allocation carry a neutral **"New"** marker, so the allocation is visible rather than hidden |
| G6 | No "Sponsored" or "Promoted" label at MVP because Boost is Phase 2 — **and when Boost ships, amplified impressions must be labelled** |

**Why swipe-to-next is refused, on two independent grounds.** It is the reels pattern the baseline removed (Principle 1),
and it is financially reckless: each swipe is a new stream join, so a minute of idle swiping bills transcode-adjacent
egress across several streams with no intent behind any of them. Either reason alone is sufficient; together they close
the question.

### 3.2 Poster frames, not live previews — and reuse what moderation already sampled

**Live video previews in the grid must not exist.** [My Recommendation] The arithmetic:

| Pattern | Cost |
|---|---|
| 12 tiles previewing live 360p (0.8 Mbps) for a 5-minute browse | 12 × 0.8 Mbps × 300 s = 0.36 GB ≈ **$0.011 per browse session** |
| A full hour of actually watching at 480p | 0.56 GB ≈ **$0.017** |

A five-minute *browse* would cost about **two thirds of a full hour of watching**, with no revenue attached and no
viewer having chosen any of it. At scale this is a second delivery bill created by a UI decision.

**Instead:** a **poster frame refreshed every ~10 seconds**, identical for every viewer, therefore CDN-cached and
effectively free.

**And it already exists.** The moderation layer samples keyframes from every live stream (moderation §4.3, baseline
tier 60 s / elevated 10 s). **The grid's poster frame is that same keyframe.** One extraction serving two purposes,
with no new pipeline. The only addition is that a poster frame must be withheld while a stream sits in a Hot
moderation tier or a pending report — the grid must never be the surface that publishes a frame moderation is still
deciding about.

### 3.3 Geo default

Principle 10 gives viewers worldwide exploration; blocking applies only under direct legal prohibition.

| Requirement | Detail |
|---|---|
| G7 | Default to **the viewer's region** — Geo Match is a ranking signal and regional relevance is genuinely higher |
| G8 | A **one-tap "Worldwide"** toggle, visible without entering a menu. Global access that is three taps deep is not global access |
| G9 | Coarse region only (country-level), never precise location |
| G10 | A region is removed from a viewer's view **only** under direct legal prohibition, with the reason surfaced in the filter UI rather than silently hidden |

---

## 4. V3 — The empty state

Treat this as the flagship screen of launch week, because it will be.

| # | Requirement |
|---|---|
| E1 | Never show an error, a shrug, or an apology. State plainly that nothing is live in this category right now |
| E2 | Show **the next scheduled broadcasts** in this category with times in the viewer's timezone |
| E3 | Offer **Remind-me** on any scheduled slot |
| E4 | Offer **adjacent live categories** — something is live somewhere |
| E5 | Explain **Market Hours** for this category in one line, so the viewer learns when to come back |
| E6 | Offer the Worldwide toggle: empty locally rarely means empty globally |
| E7 | **Never** show products, prices, past broadcasts, or a catalogue of any kind. This is the screen where pressure to break Principle 1 will be strongest, and where breaking it would be most tempting because the alternative looks like emptiness |

**Instrument it.** *Empty-state encounter rate* — the share of sessions that hit E1 — is a launch-health metric, not a
UI detail. If it exceeds roughly 30% of sessions, the beachhead is too wide and the correct response is to narrow it,
not to soften the copy.

---

## 5. V5–V7 — Watching, chatting, contacting

### 5.1 Watch surface

| # | Requirement |
|---|---|
| W1 | LL-HLS playback, ABR ladder identical for every seller tier (pricing §1) |
| W2 | Default 480p; **HD is viewer opt-in** and remembered per device (financial §1, pricing §1) |
| W3 | Visible: category, seller display name, **legal status**, region, coarse audience band, elapsed time |
| W4 | **No like, reaction, gift, tip, or transfer control anywhere** (Principle 3) |
| W5 | Report control always reachable (matrix G1) |
| W6 | On weak connection: degrade quietly, show a "weak connection" indicator, never a modal blocking the video |
| W7 | No "up next", no autoplay of another broadcast on any path |

**Coarse audience band, not an exact count** [My Recommendation] — "50+ watching" rather than "53". Carried over from
seller PRD §10.2 and still an owner's call: a precise public counter is the seed of a popularity contest, and
Principle 3 removed that economy deliberately. The counter-argument — that bands read as evasive and cost real social
proof — is legitimate.

### 5.2 Chat

| # | Requirement |
|---|---|
| C1 | Requires a minimal account (§7); anonymous viewers watch but do not post |
| C2 | Word filter and slow mode active by default, seller-adjustable (matrix E1) |
| C3 | No message reactions, no upvotes, no pinned-donation equivalent (Principle 3) |
| C4 | Report and block on every message |
| C5 | Chat is not retained beyond the short moderation and appeal window (matrix §7) |

### 5.3 Contact Request — the buyer's only conversion path at MVP

| # | Requirement |
|---|---|
| CR1 | Available **only while the session is live** (Principle 9). The control does not exist when offline |
| CR2 | Before submitting, the seller's **legal status** is shown at full prominence — Individual / Business / Company / International |
| CR3 | Payload minimal: chosen contact channel plus an optional short message (matrix H2) |
| CR4 | The viewer is told plainly how long the seller can keep their details and that it is then deleted |
| CR5 | Requires the minimal account (§7) |
| CR6 | No viewer profile is created, exposed, or browsable by the seller |

---

## 6. V10 — When the broadcast ends while you are watching

Principle 1 means this happens abruptly and often, including mid-sentence when a seller's connection drops. It is the
screen most likely to feel broken, and the temptation to fill it with a feed is exactly the temptation to abandon the
baseline.

| State | What the viewer sees |
|---|---|
| Seller ended deliberately | "This broadcast has ended." Seller's next scheduled slot if any · Remind-me · Return to grid |
| Ingest lost, within `T_reconnect` | "The broadcast was interrupted." A bounded wait with a visible countdown; auto-resume if it returns |
| Ingest lost beyond `T_reconnect` | Same as ended, with the interruption named honestly |
| Terminated by moderation | A neutral "This broadcast is no longer available." **No detail** — enforcement reasons are not viewer-facing |
| Seller's allowance exhausted | "This broadcast has ended." The viewer never learns it was a billing event |

**Forbidden on all five:** autoplay of another broadcast, a recommendation feed, a replay offer, or a catalogue of the
seller's products. The permitted actions are exactly three: wait (where applicable), remind me, go back.

**Note the asymmetry against the seller PRD.** The seller sees five distinct endings because they need to act on the
difference. The viewer sees three, because the difference between "ran out of hours" and "walked away" is the seller's
private business. Collapsing them protects the seller without misleading the viewer.

---

## 7. V11 — Viewer account: how little is enough

| Action | Account required? |
|---|---|
| Browse the grid, filter, view the schedule | **No** — anonymous. Principle 10's global exploration should not require a signup wall |
| Watch a live broadcast | **No** |
| Post in chat | **Yes** — minimal |
| Create a Contact Request | **Yes** — minimal |
| Set Remind-me | **Yes** — minimal (it needs a delivery channel) |
| Pass the age gate for sensitive categories | Declared age, no account [Open] — §9.2 |

"Minimal" means: a verified contact channel, a display name, declared interest categories, declared age. **No profile
page, no public presence, no watch history, no follower relationships.**

### 7.1 Two honest consequences

**Anonymous watching weakens a ranking signal.** Unique Viewers (Principle 6) becomes device-signal-based rather than
identity-based, which makes it noisier and more gameable. This is a real cost of the open-access decision, and it is
the clearest argument for why the matrix G5 anti-abuse *instrumentation* belongs at MVP even though enforcement is
[Deferred] under Principle 14. Flagged rather than solved.

**No watch history means a viewer cannot find yesterday's seller.** No search (MVP), no history, no catalogue — a
viewer who saw something they liked and left has no route back. That is a genuine usability hole created by three
correct decisions.

[My Recommendation] **Device-local saved sellers**: a private list, capped (~20), stored **on the device**, holding
nothing but seller identifiers. No server-side profile, no cross-device sync, no visibility to the seller, no
follower count, no effect on ranking. It solves the need at the smallest possible data footprint and stays inside
Principle 7 because the platform never holds it.

---

## 8. V9 — Age gate and sensitive-content notices

Principle 10 is explicit: **age gates and sensitive-content notices instead of blanket hiding.**

| # | Requirement |
|---|---|
| A1 | Sensitive categories carry an interstitial naming **why** it is shown, not a generic warning |
| A2 | Shown **once per category per session** — per-broadcast would train viewers to dismiss it unread |
| A3 | Age gate for age-restricted categories; strength per market is [Open] and a counsel question (matrix R3) |
| A4 | A declined notice returns the viewer to the grid with that category filtered out for the session, never to a dead end |
| A5 | Blanket regional hiding **only** under direct legal prohibition, with the reason surfaced (§3.3 G10) |

---

## 9. The buyer-trust problem — and a possible Change Request

### 9.1 State the problem plainly

A buyer deciding whether to send a Contact Request or later pay an invoice has, at MVP, exactly three trust signals:

1. The seller's **legal status** (Individual / Business / Company / International).
2. **What they can see live** — the person, the goods, the answers to their questions.
3. The **platform's policy** and the visible existence of reporting.

There are no ratings, no reviews, no transaction history, no "Verified" badge, no order count, no return record.
Compared with any established marketplace this is a very thin basis for a stranger to send their phone number, let
alone pay an invoice in Phase 2.

**In fairness, signal 2 is stronger here than on a catalogue marketplace.** Watching a person handle a product and
answer an unscripted question is high-bandwidth evidence — it is the baseline's actual bet, and it is a reasonable
one. But it evaporates the moment the stream ends, which is when the payment decision is usually made.

### 9.2 What can be done without touching a principle

| Lever | Detail |
|---|---|
| Legal status at full prominence | Never a badge, never a score — but never buried either (CR2, W3) |
| Stronger tier-1 identity for higher-risk categories | An onboarding rule, not a public mark |
| Policy transparency | A plainly-written, linked buyer-protection page: what the platform does and does not guarantee |
| Visible enforcement | Reporting that visibly works builds more trust than a badge does |
| Phase-2 invoicing | An invoice issued on-platform is itself a trust artefact |

### 9.3 Possible Change Request — seller ratings or reviews

**Not requested now.** Raised so that it is not later introduced without scrutiny.

If the pilot shows buyer hesitancy is the conversion blocker — measurable as a high watch-to-Contact-Request
drop-off with no other explanation — a seller ratings or reviews mechanism becomes the obvious remedy, and it would
collide with the baseline in two places:

| Collision | Detail |
|---|---|
| **Principle 12** | A visible trust score is a verification signal in all but name, and the baseline removed the "Verified" concept deliberately |
| **Principle 6** | A rating would be under permanent pressure to become a ranking signal, and ranking signals are fixed and sales-blind |

**If it is ever pursued**, my recommendation would be the narrowest version: ratings visible **only** to the
individual buyer who is deciding, never aggregated into a public score, and **structurally unreadable by the ranking
module** — the same isolation the matrix already requires between ranking and the commerce tables. That is a Change
Request with an impact statement, not a growth experiment, and it should not be attempted in the smaller form.

---

## 10. Negative acceptance criteria

For CI, extending the seller PRD's list (§8 there) to the viewer surfaces.

| # | Assertion |
|---|---|
| N1 | No endpoint serves a past broadcast to a viewer |
| N2 | No like, reaction, gift, tip, or viewer→seller transfer control exists on any viewer surface |
| N3 | No follower count, reaction counter, or seller leaderboard renders |
| N4 | The grid returns a bounded page; no endpoint supports infinite or swipe-through stream traversal |
| N5 | No autoplay of a second broadcast on any path, including session end |
| N6 | The grid tile payload contains no product, price, or inventory field |
| N7 | Contact Request creation fails for any session not `LIVE` |
| N8 | No server-side viewer watch history is written |
| N9 | No "Verified" affordance; legal status has no badge, colour cue, or ordering effect |
| N10 | Grid poster frames are withheld for streams in a Hot moderation tier or with an open report |
| N11 | No grid surface opens more than one concurrent video stream |

N11 is the one that will be argued with by a designer, and it is the one that protects the P&L (§3.2).

---

## 11. Metrics

Aggregate-only (Principle 7).

| # | Metric | Why |
|---|---|---|
| 1 | **Empty-state encounter rate** | Launch health; >30% means narrow the beachhead (§4) |
| 2 | Grid → join rate | Whether the grid communicates anything |
| 3 | Join → 3-minute retention | Feeds the Retention ranking signal |
| 4 | Worldwide-toggle usage | Whether Principle 10's global access is real in practice or theoretical |
| 5 | Remind-me → attendance | Validates the schedule mechanism (matrix B5) |
| 6 | Watch → Contact Request rate | §9's diagnostic: the buyer-trust signal |
| 7 | Sensitive-notice decline rate | Whether notices are calibrated or just friction |
| 8 | Report rate per 1,000 viewer-hours | Moderation load input |
| 9 | Median session watch time | Matrix §5 target ≥3 min |

---

## 12. Open items

| # | Item | Owner |
|---|---|---|
| 1 | Exact audience count vs. coarse band (§5.1) — a values question, carried from PRD §10.2 | Owner |
| 2 | Age-assurance strength per market (§8 A3) | Counsel (matrix R3) |
| 3 | Device-local saved sellers — accept or reject (§7.1) | Owner |
| 4 | Whether anonymous watching is acceptable given the Unique Viewers signal weakening (§7.1) | Owner + architecture |
| 5 | Ratings/reviews as a future CR (§9.3) — do not pursue now; revisit only on the §11 metric 6 signal | Owner |
| 6 | Search pull-forward trigger — matrix D6 sets >50 concurrent per category × region | Product |
| 7 | Boost labelling requirements for Phase 2 (§3.1 G6) | Product, with Phase 2 |

## 13. Assumptions

| # | Assumption | Validate with |
|---|---|---|
| A1 | A 10-second poster refresh reads as "live" to viewers | Pilot usability testing |
| A2 | The moderation keyframe is suitable as a grid poster (framing, quality) | Streaming PoC |
| A3 | Region-default with a one-tap global toggle satisfies Principle 10 in practice | Metric 4 |
| A4 | Buyer trust holds on legal status plus live observation alone | Metric 6 — **the assumption most likely to be wrong, and §9.3 is its contingency** |
| A5 | Empty-state content retains viewers rather than teaching them to leave | Metric 1 plus return-visit rate |
