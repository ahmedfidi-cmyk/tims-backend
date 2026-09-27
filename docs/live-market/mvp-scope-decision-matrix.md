# LIVE MARKET — MVP Scope Decision Matrix

| | |
|---|---|
| **Document type** | Scope decision record (consultant deliverable) |
| **Baseline** | LIVE MARKET approved baseline, 27 September 2026 |
| **Date** | 2026-09-27 |
| **Prepared by** | Senior Product Consultant & Solution Architect |
| **Status** | Recommendation — awaiting owner sign-off on §11 (Change Requests) and §12 (remaining Open items) |
| **What this document closes** | MVP scope: what ships at launch, what is Phase 2, what is Phase 3, and what is out by principle |
| **What this document does NOT close** | Streaming architecture selection (separate deliverable), package pricing numbers, transaction-fee model and platform legal role, Boost mechanics detail |

> **How to read the tags.** Every element below carries one of four tags:
> **[Approved]** = follows directly from the 27 Sep 2026 baseline, not re-opened here.
> **[Open]** = a baseline-declared open question; this document either closes it for MVP purposes or names who must.
> **[Deferred]** = explicitly out of the baseline's design surface; referenced only as a boundary.
> **[My Recommendation]** = my judgement, not baseline. Owner may reject without touching the baseline.
>
> **Standing caveat.** Every regulatory, financial, legal, tax, and app-store statement in this document is an
> **assumption requiring specialised per-country validation** by qualified counsel and by an app-store submissions
> specialist. Nothing here is legal advice. The assumption register in §9 is the list to send to counsel.

---

## 1. Decision rules

To keep the cut line defensible rather than taste-based, every candidate capability is scored on five axes.

| Axis | Code | Question | Weight | Scale |
|---|---|---|---|---|
| Principle integrity | **PI** | If this is absent at launch, does a non-negotiable principle have no implementation? | ×5 | 0–3 |
| Launch gate | **LG** | Does a regulator, an app store, or physics block launch without it? | ×5 | 0–3 |
| Liquidity / cold-start | **LQ** | Does it create or protect the supply↔demand loop in a market with no inventory? | ×5 | 0–3 |
| Revenue enablement | **RV** | Does it enable or protect the paid-broadcasting revenue line? | ×4 | 0–3 |
| Build cost | **BC** | Engineering + ops cost to reach production quality (higher = more expensive) | ×−3 | 0–3 |

**Score = (5·PI) + (5·LG) + (5·LQ) + (4·RV) − (3·BC)**  — range −9 to +57.

**Cut lines**

| Score | Verdict |
|---|---|
| ≥ 26 | **MVP** |
| 16 – 25 | **Phase 2** (first 90 days post-launch) |
| ≤ 15 | **Phase 3 / hold** |

**Overrides (deliberate, and always footnoted where used)**

1. **PI = 3 → MVP.** A non-negotiable principle with no implementation at launch means the product shipped is not the product that was approved.
2. **LG = 3 → MVP, at minimum viable tier.** A launch gate is not negotiable, but its *tier* is: "manual, ops-executed, documented" is a legitimate MVP implementation of a legal duty.
3. **Retrofit-cost override → MVP (schema only).** Where a cheap data-model decision today prevents an expensive migration later, the schema ships at MVP even if the UI does not. Used exactly once (A4).

Where an override moves an item across the cut line, the row is marked `†` and the reason is stated. Overrides are
visible on purpose — an unexplained override is how scope creep gets laundered into a matrix.

---

## 2. Master decision matrix

Scores are mine; the axes and cut lines above make them arguable, which is the point. Challenge any row by
challenging its axis score, not the verdict.

### A. Identity & accounts

| # | Capability | PI | LG | LQ | RV | BC | Score | Verdict | Tag |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Account creation + auth (phone/email OTP, session management) | 2 | 3 | 2 | 1 | 1 | **36** | MVP | [Open]→closed |
| A2 | Legal-status classification & display — Individual / Business / Company / International | 3 | 3 | 1 | 1 | 1 | **36** | MVP | [Approved] |
| A3 | KYC tier-1: document upload + manual review for Business / Company / International | 1 | 3 | 0 | 1 | 2 | **18** † | MVP (minimum tier) | [Open]→closed |
| A4 | Org model — one account may own N broadcaster identities (data model only, no UI) | 1 | 0 | 1 | 2 | 1 | **15** † | MVP (schema only) | [My Recommendation] |
| A5 | Broadcaster seats UI + per-seat permissions | 1 | 0 | 1 | 3 | 2 | **16** | Phase 2 | [Open]→sequenced |
| A6 | Concurrent multi-country streams per organisation | 1 | 0 | 1 | 3 | 2 | **16** | Phase 2 | [Open]→sequenced |

`†` A3: LG=3 override — trader identification and anti-fraud duties apply from the first paid seller (see §9).
`†` A4: retrofit-cost override — bolting a multi-seat org model onto a single-user account table after launch is a
migration across auth, billing, entitlements and analytics. The schema is days; the retrofit is months.

**No "Verified" concept anywhere in the UI.** [Approved] — accounts display legal status only. Add an explicit QA
assertion: no badge, tick, shield, or ranking bonus derived from status.

### B. Broadcast & session

| # | Capability | PI | LG | LQ | RV | BC | Score | Verdict | Tag |
|---|---|---|---|---|---|---|---|---|---|
| B1 | Go-Live flow — category, title, target markets, commerce mode, pre-flight check | 3 | 2 | 3 | 3 | 2 | **46** | MVP | [Open]→closed |
| B2 | Session lifecycle: hard stop, no grace period, ad ends on disconnect | 3 | 0 | 2 | 1 | 1 | **26** | MVP | [Approved] |
| B3 | Streaming pipeline: WebRTC ingest → SFU → LL-HLS fanout, ABR ladder incl. 360p | 3 | 3 | 3 | 2 | 3 | **44** | MVP | [Open]→see §13 |
| B4 | Audio-only fallback mode | 1 | 0 | 2 | 1 | 2 | **13** | Phase 2 | [Open]→sequenced |
| B5 | Scheduled Live + Notify-me (paired capability) | 2 | 0 | 3 | 2 | 2 | **27** | MVP | [My Recommendation] |
| B6 | Co-broadcast / audience guest video | 0 | 0 | 1 | 1 | 3 | **0** | Phase 3 | [Open]→sequenced |
| B7 | Recording / replay / VOD | — | — | — | — | — | — | **Out by principle** | [Approved] |

**B5 is the single most contested MVP row, so the reasoning is explicit.** A live-only market with no catalogue and
no replay has no surface on which *future* supply can be discovered. The schedule is the compensating mechanism the
baseline's own constraints imply, which is why I scored PI=2 rather than 1. Guardrails that keep it from drifting
into a catalogue — **all three are mandatory**:

1. A schedule card carries **category, seller legal status, title, region, start time** only. No SKU, no price, no product image gallery, no add-to-cart, no inventory count.
2. The card **expires when the session ends or the slot lapses** — it never becomes a persistent product record.
3. Scheduling is **not** a ranking signal and confers no organic advantage (Principle 6).

If the owner judges that even this breaches Principle 1, B5 becomes a Change Request. I do not believe it does, and
I request the clarification in §11.C rather than presenting it as a CR.

### C. Packages, billing & revenue

| # | Capability | PI | LG | LQ | RV | BC | Score | Verdict | Tag |
|---|---|---|---|---|---|---|---|---|---|
| C1 | Package catalogue + purchase, globally unified sticker price, multiple tiers | 3 | 2 | 1 | 3 | 2 | **36** | MVP | [Approved] |
| C2 | Out-of-app (web) purchase path; app surfaces entitlements only | 1 | 3 | 0 | 3 | 1 | **29** | MVP | [My Recommendation] + CR-02 |
| C3 | Entitlement enforcement — minutes / sessions / seats / geo scope | 2 | 1 | 1 | 3 | 2 | **26** | MVP | [Open]→closed |
| C4 | Boost — paid amplification, Qualified View definition, frequency caps | 1 | 0 | 2 | 3 | 3 | **18** | Phase 2 | [Open]→sequenced |
| C5 | LM viewer rewards funded from advertiser campaign budget | 1 | 0 | 3 | 2 | 3 | **19** | Phase 2 | [Open]→sequenced |
| C6 | LM top-up / purchase by viewers, custody, transferability | — | — | — | — | — | — | **Out of MVP** | [Deferred] |
| C7 | Refund / package-credit policy (published policy + manual ops path) | 1 | 2 | 0 | 2 | 1 | **20** † | MVP (minimum tier) | [Open]→closed |

`†` C7: LG=3 in effect — a right of withdrawal from a digital service contract is a consumer-law duty in several
target jurisdictions, and the app stores expect a stated refund path. MVP implementation is a published policy plus
an admin-executed credit, not an automated engine.

**C5/C6 boundary, stated precisely.** Principle 13 approves that viewer rewards are advertiser-funded and never
platform-subsidised. Everything about how LM is topped up, custodied, transferred, or valued off-platform is
[Deferred] to the separate workstream. Therefore Phase-2 LM must be built as a **non-transferable, non-cashable,
platform-internal ledger entry** with no off-platform exit. Building it any other way pre-commits decisions the
deferred workstream owns. This also happens to keep LM out of app-store digital-currency rules at MVP — see §8.

### D. Discovery & ranking

| # | Capability | PI | LG | LQ | RV | BC | Score | Verdict | Tag |
|---|---|---|---|---|---|---|---|---|---|
| D1 | Live market grid (category × geo) + age gate + sensitive-content notices | 3 | 3 | 3 | 1 | 2 | **43** | MVP | [Approved] |
| D2 | Ranking v1 — Geo Match, Unique Viewers, Retention/Watch Time, Momentum, declared Interest Match | 3 | 0 | 3 | 1 | 3 | **25** † | MVP | [Approved] |
| D3 | Discovery Allocation — guaranteed impression floor for new broadcasts | 3 | 0 | 3 | 1 | 2 | **28** | MVP | [Approved] |
| D4 | Unique Shares signal + share attribution infrastructure | 1 | 0 | 2 | 1 | 2 | **13** | Phase 2 | [Approved] signal, sequenced |
| D5 | Implicit / behavioural Interest Match | 1 | 0 | 2 | 1 | 3 | **10** | Phase 3 | [My Recommendation] |
| D6 | Free-text search | 0 | 0 | 2 | 1 | 1 | **11** | Phase 2 (trigger-gated) | [My Recommendation] |
| D7 | Global Market Access + Policy Engine (legal-prohibition region removal, never campaign rejection) | 3 | 3 | 1 | 1 | 3 | **30** | MVP | [Approved] |

`†` D2: PI=3 override. Principle 6 is non-negotiable, so *a* fair ranker ships at launch; the MVP tier is the five
signals above with **declared** (self-selected at signup) Interest Match, not behavioural inference. Declared
interest is simultaneously cheaper, cold-start-proof, and better aligned with Principle 7 data minimisation.

**Sales value and sales count are not inputs to any ranking code path.** [Approved] Enforce with a unit test that
fails if the ranking module can even read the commerce tables.

**Search is a catalogue reflex.** At launch, category + geo filters over a few dozen concurrent streams is a
complete discovery surface. Pull-forward trigger in §4.

### E. Live interaction

| # | Capability | PI | LG | LQ | RV | BC | Score | Verdict | Tag |
|---|---|---|---|---|---|---|---|---|---|
| E1 | Live text chat + per-session moderation controls (mute, eject, slow mode, word filter) | 2 | 3 | 3 | 1 | 2 | **38** | MVP | [Open]→closed |
| E2 | Contact Request — creatable during a Live session only, unavailable offline | 3 | 0 | 2 | 3 | 2 | **31** | MVP | [Approved] |
| E3 | Voice / video guest from audience | 0 | 0 | 1 | 1 | 3 | **0** | Phase 3 | [Open]→sequenced |
| E4 | Likes / gifts / tipping | — | — | — | — | — | — | **Out by principle** | [Approved] |

**E4 needs an active guard, not just an absence.** No reaction counters, no leaderboards, no follower counts
displayed publicly, no "top seller" surfaces, no in-stream monetary transfers from viewer to seller. Add these as
explicit negative acceptance criteria — absence-by-principle erodes silently under feature pressure.

### F. Commerce modes

| # | Capability | PI | LG | LQ | RV | BC | Score | Verdict | Tag |
|---|---|---|---|---|---|---|---|---|---|
| F1 | Exposure Only mode | 3 | 0 | 2 | 2 | 0 | **33** | MVP | [Approved] |
| F2 | Lead Generation mode (Contact Request → minimised seller-side handoff) | 3 | 1 | 2 | 3 | 2 | **36** | MVP | [Approved] |
| F3a | Invoice issuance, payment settled off-platform by the seller | 2 | 1 | 1 | 2 | 2 | **22** | Phase 2 | [Approved] mode, sequenced |
| F3b | Platform-collected payment + transaction fee | 1 | 2 | 0 | 3 | 3 | **18** | Phase 2 | [Open] — blocked on legal role |
| F4 | Deposit mode | 1 | 1 | 0 | 2 | 3 | **9** | Phase 3 | [Approved] mode, sequenced |
| F5 | Mandatory escrow | — | — | — | — | — | — | **Out by principle** | [Approved] |

**The MVP monetises broadcasting, not transactions.** This is the largest scope decision in the document and it is
*consistent with* Principle 2, which already names paid broadcasting — not commission — as the core revenue source.
Principle 8 approves four optional commerce modes as the model; it does not require all four on day one, and nothing
in the MVP makes any mode mandatory. Shipping Exposure Only + Lead Generation first removes the payments-licensing
critical path (which owns the [Open] "transaction fee vs. platform legal role" question, where the 10% figure is
explicitly **not approved**) from the launch date, and defers merchant-of-record, PSP onboarding, refund
liability, chargeback exposure, and possible money-transmission licensing to a phase where the market's existence is
already proven. **Principle 8 remains intact:** the buyer still never pays before an Invoice exists, because at MVP
the platform never takes a payment at all.

### G. Trust, safety & moderation

| # | Capability | PI | LG | LQ | RV | BC | Score | Verdict | Tag |
|---|---|---|---|---|---|---|---|---|---|
| G1 | In-stream report + block + eject + published contact point + prompt takedown | 2 | 3 | 1 | 1 | 2 | **28** | MVP | [Open]→closed |
| G2 | Automated in-stream classification (sampled keyframes + audio ASR) + kill switch | 1 | 3 | 1 | 1 | 3 | **20** † | MVP (minimum tier) | [Open]→closed |
| G3 | Moderation evidence buffer — rolling ~120 s, purged on close | 1 | 3 | 0 | 1 | 2 | **18** † | MVP, **pending CR-01** | [My Recommendation] |
| G4 | Human moderation queue + follow-the-sun rota with SLA | 1 | 3 | 0 | 1 | 3 | **15** † | MVP (minimum tier) | [Open]→closed |
| G5 | Anti-Abuse architectural readiness (instrumentation + hooks, enforcement off) | 2 | 0 | 1 | 1 | 2 | **13** † | MVP (hooks only) | [Approved] readiness |

`†` G2/G4: LG=3 override — user-generated live content carries explicit store-review duties (§8) and illegal-content
duties in several jurisdictions (§9). The *tier* is negotiable, the existence is not.
`†` G5: Principle 14 states Anti-Abuse is architectural readiness activated only against bots/synthetic traffic.
Readiness is therefore an MVP architectural obligation; **enforcement stays [Deferred]**. Natural human
LM-collecting behaviour is never treated as abuse, and no enforcement rule ships at MVP.
`†` G3: see CR-01. **If CR-01 is rejected, G3 does not ship** and §11 names what breaks instead.

**A 24/7 global market implies 24/7 moderation coverage from day one.** This is an ops hiring decision with a lead
time longer than most of the engineering in this document — it belongs on the critical path, not in a launch-week
scramble. [My Recommendation]: 3 shifts, minimum 2 moderators per shift at launch concurrency, escalation path to a
named on-call policy owner.

### H. Data & analytics

| # | Capability | PI | LG | LQ | RV | BC | Score | Verdict | Tag |
|---|---|---|---|---|---|---|---|---|---|
| H1 | Aggregated seller session statistics (unique viewers, retention curve, geo buckets) | 2 | 0 | 2 | 3 | 2 | **26** | MVP | [Approved] |
| H2 | No permanent lead CRM — retention ceiling + automated purge job | 3 | 2 | 0 | 1 | 1 | **26** | MVP | [Approved] |
| H3 | No video storage — transcode-and-discard pipeline | 3 | 0 | 0 | 1 | 1 | **16** † | MVP | [Approved] |
| H4 | Advertiser-facing campaign analytics (pairs with Boost) | 1 | 0 | 1 | 2 | 2 | **12** | Phase 2 | [Open]→sequenced |

`†` H3: PI=3 override. Also note H3 is cheaper than the alternative — not storing video is the absence of a storage
bill, and it is a genuine cost advantage of this baseline over conventional live commerce.

**H1 is load-bearing for revenue retention.** A seller who pays for broadcasting and receives no evidence of value
will not renew. Aggregated-only statistics satisfy Principle 7 and are sufficient: unique viewers, retention curve,
region buckets, Contact Requests created. No viewer identities, no per-viewer traces.

### I. Platform & operations

| # | Capability | PI | LG | LQ | RV | BC | Score | Verdict | Tag |
|---|---|---|---|---|---|---|---|---|---|
| I1 | PSP integration for seller-side package payments (cards + local methods in beachhead) | 1 | 3 | 0 | 3 | 2 | **26** | MVP | [Open]→closed |
| I2 | Admin console — suspend account, kill stream, refund/credit, policy override, audit log | 1 | 3 | 0 | 1 | 2 | **18** † | MVP | [My Recommendation] |
| I3 | Delivery-cost telemetry dashboard (cost per viewer-hour, egress per session) | 1 | 2 | 0 | 2 | 1 | **20** | Phase 2 | [My Recommendation] |
| I4 | Arabic + English, RTL-correct | 1 | 1 | 2 | 1 | 2 | **18** | **Conditional** — MVP if beachhead is MENA, else Phase 2 | [My Recommendation] |
| I5 | AI assistant (stream prep, category/target-market suggestions, viewer market Q&A) | 2 | 0 | 2 | 1 | 2 | **18** | Phase 2 | [Open] boundaries unresolved |
| I6 | Delivery-cost controls — per-tier concurrency ceiling, default 480p rung, auto-degrade | 2 | 1 | 1 | 3 | 2 | **26** | MVP | [My Recommendation] |

**I3 has an MVP prerequisite even though the dashboard is Phase 2:** log **bytes egressed and transcode-seconds per
session** from day one. One field each. Without it the Phase-2 dashboard starts with no history, which is exactly
when you need the history.

**I5 and Principle 4, read precisely.** "AI is free for all users, never sold as a paid advantage" is a *pricing and
fairness* constraint on AI, not an instruction to ship AI at MVP. Deferring AI to Phase 2 does not touch Principle 4.
When it ships it must be free for every tier, and must not influence organic ranking. The [Open] question of AI
boundaries *during* a live session (can it speak? transcribe? translate? answer as the seller?) stays open and must
be closed before I5 is built — it has moderation and misrepresentation consequences.

---

## 3. MVP scope — the cut line

The MVP is split into two tiers so the scope remains reducible under schedule pressure without a re-run of this
matrix:

- **P0 — ship-blocking.** A legal, functioning, revenue-generating live market. Cutting any P0 item means either no
  launch or a launch that violates a principle, a store rule, or a law.
- **P1 — MVP-complete.** Required for the public launch to be credible and for sellers to renew. Acceptable to cut
  *only* for a closed pilot with invited sellers.

**This MVP is not small, and pretending otherwise would be the real risk.** The floor is set by three things the
baseline chose deliberately: real-time streaming infrastructure, user-generated live content duties, and a paid
revenue line that must work on day one. The compensating decision is what we keep *out*: platform-collected
payments, Boost, LM, and enterprise multi-seat — which together are the majority of the remaining build.

### 3.1 P0 — ship-blocking

| # | Item | Minimum acceptable implementation at P0 |
|---|---|---|
| A1 | Auth | OTP sign-in, session management, account recovery |
| A2 | Legal status | Four statuses, self-declared at signup, displayed on every broadcast surface; no "Verified" affordance |
| A3 | KYC tier-1 | Document upload + manual review + decision record for Business / Company / International; Individual sellers unverified at MVP because MVP takes no buyer payments |
| A4 | Org model | Schema only: `account` 1→N `broadcaster_identity`; no UI |
| B1 | Go-Live flow | Category, title, target markets, commerce mode (Exposure / Lead Gen), device pre-flight (camera, mic, uplink test) |
| B2 | Session lifecycle | Hard stop on end/disconnect, no grace period, broadcast removed from grid within seconds, Contact Request creation disabled the instant the session ends |
| B3 | Streaming pipeline | WebRTC ingest → SFU → LL-HLS fanout, ABR ladder with a 360p rung, documented latency target (§13) |
| C1 | Packages | ≥3 tiers, one globally unified sticker price per tier, entitlement issuance |
| C2 | Web purchase path | Purchase completes on web; mobile app displays entitlements and never contains an in-app purchase or a non-compliant external link (§8) |
| C3 | Entitlements | Enforce broadcast minutes/sessions, concurrency = 1 at MVP, geo scope of target markets |
| C7 | Refund policy | Published policy + admin-executed credit path + audit record |
| D1 | Market grid | Category × geo browse, age gate, sensitive-content notice interstitial |
| D2 | Ranking v0 | Geo Match + Momentum + Retention + Discovery Allocation floor; declared Interest Match; commerce tables unreadable from the ranking module |
| D3 | Discovery Allocation | Impression floor for new broadcasts, decaying with completed-session count |
| D7 | Policy Engine | Country-level and category-level allow/deny evaluated against the advertiser's selected target markets; **removes regions, never rejects the campaign** |
| E1 | Live chat + controls | Text chat, word filter, slow mode, mute, eject, seller-side chat disable |
| G1 | Report / block / takedown | In-stream report, block, published contact point, prompt takedown + account ejection capability |
| G2 | Automated classification | Sampled keyframe classification + audio ASR screening + automated kill switch on high-confidence violations |
| G3 | Evidence buffer | Rolling ~120 s, encrypted, purged on session close unless a report is open — **pending CR-01** |
| G4 | Human moderation | 24/7 rota, triage SLA, escalation path, decision log |
| H2 | No lead CRM | Retention ceiling on Contact Request payloads + automated purge job + purge audit |
| H3 | No video storage | Transcode-and-discard; no VOD bucket exists in the infrastructure at all |
| I1 | PSP | Card + beachhead local methods for seller-side package purchase |
| I2 | Admin console | Suspend, kill stream, credit, policy override, full audit log |
| I6 | Cost controls | Per-tier concurrency ceiling, default 480p rung, auto-degrade on QoE or cost threshold |
| I3* | Cost telemetry (fields only) | Bytes egressed + transcode-seconds logged per session |

### 3.2 P1 — MVP-complete

| # | Item | Why it is MVP and not Phase 2 |
|---|---|---|
| B5 | Scheduled Live + Notify-me | The only surface on which future supply is discoverable in a no-catalogue, no-replay market. Do not cut for public launch. |
| E2 | Contact Request | Principle 9 is approved; without it Lead Generation cannot exist and sellers have no outcome to point at |
| F2 | Lead Generation mode | The second commerce mode, and the one that makes broadcasting demonstrably worth paying for |
| H1 | Seller session statistics | Proof of value for the only revenue line; without it renewal rates are unmanageable |
| G5 | Anti-Abuse readiness hooks | Principle 14 makes readiness architectural; hooks now, enforcement [Deferred] |
| I4 | AR/EN + RTL | Conditional on the beachhead decision — MVP if MENA |

---

## 4. Phase 2 and Phase 3, with pull-forward triggers

A phase assignment without a trigger is a wish. Each item below names the observable condition that promotes it.

### Phase 2 — first 90 days post-launch

| # | Item | Pull-forward trigger |
|---|---|---|
| C4 | Boost + Qualified View + frequency caps | Sellers in ≥2 categories request paid amplification, **or** organic impression supply per broadcast falls below the level that makes packages renewable |
| C5 | LM viewer rewards (non-transferable internal ledger) | Viewer session-depth plateaus below target and Discovery Allocation alone is not closing it |
| F3a | Invoice issuance (payment off-platform) | ≥20% of Contact Requests self-report converting to an off-platform sale — i.e. sellers are already invoicing, badly |
| F3b | Platform-collected payment + fee | Legal role decision closed **and** PSP/merchant-of-record structure validated per country (§9) |
| A5/A6 | Broadcaster seats + concurrent multi-country streams | One enterprise anchor advertiser signs a letter of intent for a multi-seat package |
| B4 | Audio-only fallback | >15% of sessions in any launch market spend >30% of watch time below ~300 kbps |
| D4 | Unique Shares signal | Off-platform share volume becomes measurable enough not to be gameable by a handful of actors |
| D6 | Free-text search | >50 concurrent broadcasts in any single category × region cluster |
| H4 | Advertiser campaign analytics | Ships with C4; Boost without analytics is unsellable |
| I3 | Cost dashboard | Delivery cost exceeds 30% of package revenue in any month |
| I5 | AI assistant | Ships once the [Open] "AI boundaries during live sessions" question is closed |

### Phase 3 / hold

| # | Item | Condition to revisit |
|---|---|---|
| B6/E3 | Guest video / voice from audience | Moderation maturity: automated classification precision high enough that a second uncontrolled video source is not an unacceptable risk |
| D5 | Behavioural Interest Match | Only with a data-minimisation review against Principle 7, and only if declared interest demonstrably underperforms |
| F4 | Deposit mode | After F3b is stable; deposits carry the heaviest legal and refund exposure of the four modes |

### Out by principle — never scoped

Replay/VOD · permanent catalogue · feed/reels · Likes · Gifts · Tipping · public follower counts · reaction
counters · seller leaderboards · "Verified" badges · sales-based ranking · mandatory escrow · country-based pricing ·
paid-advantage AI · permanent lead CRM · video storage · blanket geographic hiding absent a direct legal prohibition.

### Out of scope by deferral

LM tokenomics, crypto, blockchain, wallet, exchange listing, custody, AML/KYC beyond tier-1 seller identification ·
Events/Tickets vertical · strict Anti-Abuse enforcement. [Deferred] — not designed here, and **no MVP decision may
pre-commit them**. The two places where MVP could accidentally pre-commit a deferred decision are C5 (build LM as a
non-transferable internal ledger, no off-platform exit) and A3 (tier-1 seller identification only — do not build a
KYC/AML framework the deferred workstream will own).

---

## 5. Cold-start plan

A live-only marketplace has the worst possible cold-start profile: **inventory exists only while a human is
performing.** At 03:00 in a launch market with 12 sellers, the market is empty, and an empty market teaches viewers
not to return. This cannot be solved with product polish; it is solved with supply concentration. All
[My Recommendation].

| # | Mechanism | What it does | Baseline compatibility |
|---|---|---|---|
| 1 | **Beachhead concentration** — launch 1 region cluster × 3 categories, not 50 countries × everything | Raises concurrent streams per (category × region) above the density where browsing feels alive | Compatible. Principle 10 is about *viewer access*, which stays global; this is a go-to-market sequencing choice about where we recruit *sellers*. Viewers worldwide may still explore everything. |
| 2 | **Market Hours** — promoted daily windows per category | Concentrates both sides into overlapping time windows instead of spreading thin across 24h | Compatible. Streaming remains permitted 24/7; Market Hours is promotion, never restriction. |
| 3 | **Scheduled Live + Notify-me** (B5) | Converts future supply into present demand; gives the empty-state something true to show | Compatible with the three guardrails in §2.B |
| 4 | **Discovery Allocation floor** (D3) | 25–35% of grid impressions reserved for new broadcasts, decaying with completed sessions | [Approved] principle; the numeric floor is my recommendation |
| 5 | **Founding Broadcaster programme** — time-boxed discounted or free packages for the first N sellers per category | Buys the initial supply that demand requires | Compatible **only if** offered on globally identical terms with a global time box. See §11.C.2 — a country-scoped launch discount *would* breach Principle 5. |
| 6 | **Demand acquisition is off-platform at MVP** | Boost (C4) is Phase 2, so launch demand comes from paid ads, category communities, and partnerships | Compatible. No Likes/Gifts economy is involved; partnerships are commercial, not fame-based. |
| 7 | **Honest empty state** | When a category has nothing live: show the schedule + Notify-me + adjacent live categories. Never a product catalogue. | Compatible; this is the design decision that keeps Principle 1 intact under the strongest pressure to break it |

**Liquidity targets for the launch window** [My Recommendation] — these are the numbers that decide whether Phase 2
starts or the beachhead narrows further:

| Metric | Target |
|---|---|
| Concurrent broadcasts per category × region cluster, during Market Hours | ≥ 5 |
| Viewers per concurrent broadcast | ≥ 20 |
| Scheduled sessions that actually go live | ≥ 60% |
| Median session watch time | ≥ 3 min |
| Seller package renewal, month 2 | ≥ 40% |
| Hours per week with zero live broadcasts in a launch category | ≤ 10 |

---

## 6. Unit economics: CDN, transcoding, and why cost is an MVP feature

**Every figure in this section is a planning assumption requiring validation against actual vendor quotes.** Public
list prices vary by an order of magnitude between on-demand and committed-volume contracts.

### 6.1 Assumed unit costs

| Component | Assumption | Note |
|---|---|---|
| 720p LL-HLS bitrate | ~2.5 Mbps ≈ **1.13 GB / viewer-hour** | |
| 480p | ~1.2 Mbps ≈ **0.54 GB / viewer-hour** | |
| 360p | ~0.8 Mbps ≈ **0.36 GB / viewer-hour** | |
| CDN egress | **$0.02 – $0.08 / GB** | Committed volume vs. on-demand; regional variance is large, especially for South Asia and South America |
| Transcode | **$0.03 – $0.10 per input-hour per output rung** | Managed service; self-hosted GPU changes the shape to fixed cost |
| WebRTC SFU (ingest + low-latency tier) | **$0.30 – $0.60 per 1,000 participant-minutes** | Managed; the dominant cost if WebRTC is used for *fanout* rather than ingest |

### 6.2 Modelled monthly delivery cost

Assumption: mixed ABR ladder averaging **0.5 GB / viewer-hour**, 8 broadcast-hours per day.

| Avg concurrent viewers | Viewer-hours / month | Egress @ $0.03/GB | Egress @ $0.06/GB |
|---|---|---|---|
| 500 | 120,000 | ~$1,800 | ~$3,600 |
| 1,000 | 240,000 | ~$3,600 | ~$7,200 |
| 5,000 | 1,200,000 | ~$18,000 | ~$36,000 |
| 10,000 | 2,400,000 | ~$36,000 | ~$72,000 |

### 6.3 The structural problem, and the MVP response

Viewers are free and cost is linear in viewer-hours. Revenue is linear in **seller packages**, not in viewer-hours.
Success on the demand side therefore degrades gross margin unless delivery cost is bounded inside the product. That
is why I6 is P0 and not a Phase-2 optimisation.

Package price floor formula [My Recommendation]:

```
DeliveryCost(tier) = BroadcastHours × AvgConcurrency × AvgGBperViewerHour × $/GB
PriceFloor(tier)   ≥ 3 × DeliveryCost(tier)        # ~70% gross margin target
```

Concrete MVP cost controls, all P0 (I6):

1. **Default rung is 480p.** HD is viewer-opt-in, not default. This is roughly a 2× swing on the entire egress bill.
2. **Per-tier concurrency ceiling.** Entry tiers carry a concurrent-viewer cap; exceeding it degrades quality rather than silently spending margin. Sell higher ceilings as a tier feature — cost-aligned, and it does not touch globally unified pricing.
3. **Auto-degrade** on QoE signals and on a per-session cost threshold.
4. **No video storage** (H3) already removes the storage and egress-of-replay line entirely — a genuine structural advantage of this baseline.
5. **Log egress and transcode-seconds per session from day one** (I3*), so tier pricing can be re-derived from real data rather than from this table.

**Package design consequence** — hand this to the packaging deliverable: tier differentiation should be built from
broadcast hours, session count, seats, geo scope, and **concurrency ceiling**, because those are the variables that
actually drive cost. Principle 5 is untouched: one sticker price per tier worldwide.

---

## 7. Data retention

| Data | MVP retention | Rationale |
|---|---|---|
| Video / audio stream content | **Not stored.** Transcode-and-discard; no VOD storage exists | Principle 7 [Approved] |
| Moderation evidence buffer | Rolling ~120 s, encrypted, purged on session close; retained only while a report is open, then purged on case closure | CR-01 — **pending approval** |
| Automated moderation classification output | Scores and labels only, no frames retained; short retention for appeal | [My Recommendation] |
| Contact Request payload (lead data) | Short hard ceiling (recommend ≤30 days), then automated purge; seller may export once within the window | Principle 7: no permanent CRM [Approved] |
| Session statistics | Aggregated only, retained indefinitely; no per-viewer rows | Principle 7 [Approved] |
| Chat messages | Short retention for moderation and appeal, then purge | [My Recommendation] |
| Account + legal-status records | Retained for the account lifetime + statutory tail | Legal duty — per-country validation required |
| KYC documents | **Recommend: do not retain the document.** Store the decision, the reviewer, the timestamp, and an expiry | [My Recommendation] — per-country validation required; some jurisdictions mandate retention of the evidence itself |
| Billing / invoice records | Statutory tax retention period | Legal duty — per-country validation required |

The tension to resolve deliberately: **statutory retention duties and Principle 7 will collide in some
jurisdictions.** The resolution is per-data-class and per-country, not global — and it is a question for counsel, not
for architecture.

---

## 8. App-store constraints

All assumptions; validate with an app-store submissions specialist. Store rules change without notice and vary by
region, and the DMA/US-litigation landscape around external purchase links is actively moving.

| Constraint (assumed) | Impact on LIVE MARKET | Mitigation | MVP consequence |
|---|---|---|---|
| **In-app purchase requirement** for digital content/services consumed in the app (Apple ~30%/15%; Google Play equivalent) | Selling broadcast packages inside the app would take a store commission and force store price tiers — which breaks a single global sticker price | Sell packages **on web only**; the app displays entitlements and Go-Live. Ad-buying products (e.g. major ad managers) are the closest precedent for treating advertising spend as out-of-scope for IAP, but this is **not** a settled exemption and must be validated | **C2 is P0.** See **CR-02** |
| **External purchase links** are permitted only under specific regional entitlements | An in-app "buy on our website" link may be non-compliant depending on store, region, and entitlement | Ship **no purchase link at all** in the MVP app; sellers purchase on web before installing or via out-of-app channels | Constrains seller onboarding UX; accept for MVP |
| **UGC duties** (Apple Guideline 1.2 and Play's UGC policy): content filtering, in-app reporting, blocking, published contact, prompt removal and user ejection | Non-negotiable for approval of any live-streaming app | G1, G2, G4 | **G1/G2/G4 are P0** |
| **Age rating** — live UGC plus commerce likely pushes to a mature rating; some markets add further requirements | Affects discoverability and marketing | Age gate + sensitive-content notices (D1) — already the [Approved] approach under Principle 10 | D1 is P0 |
| **Digital currency / virtual-token rules** | If viewers could buy LM in-app, store rules on in-app currency and possibly financial-services review would attach | LM top-up is [Deferred] and out of MVP; Phase-2 LM is advertiser-funded, non-transferable, non-cashable | Protects C5's Phase-2 design |
| **Background capture limits (iOS)** | Camera capture stops when the app is backgrounded | No mitigation needed — this *aligns* with Principle 1: leaving the stream ends the ad, with no grace period | Free alignment; document it as intended behaviour |
| **App Review needs reproducible live content** | Reviewers hit an empty market and reject for "incomplete functionality" — a real and under-appreciated risk for a live-only product | Build a **review-mode demo broadcast** + demo account that always has a live session available | Add to P0 launch checklist |
| **Permissions & purpose strings** | Camera, mic, location (for Geo Match) | Explicit purpose strings; location coarse-grained, consistent with data minimisation | Minor |

---

## 9. Regulatory assumption register

**This is the list to send to counsel, jurisdiction by jurisdiction.** Every row is an assumption, not a finding. I
am not qualified to give legal advice and this document does not.

| # | Area | Assumed exposure | Owner |
|---|---|---|---|
| R1 | Trader identification / traceability on marketplaces (e.g. EU DSA-style duties) | Business sellers must be identifiable before selling; drives A2 + A3 into P0 | Counsel per market |
| R2 | Illegal-content notice-and-action duties, including live content | Drives G1–G4 and the evidence-buffer question (CR-01) | Counsel per market |
| R3 | Online-safety regimes covering live streaming and minors | May mandate specific age-assurance strength beyond a self-declared gate | Counsel per market |
| R4 | Consumer rights / right of withdrawal on digital services | Drives C7 refund path into P0 | Counsel per market |
| R5 | Data protection (GDPR and analogues) | Lead-data minimisation, retention ceilings, lawful basis, records of processing, DPAs with PSP/CDN/AI vendors, cross-border transfer mechanisms | DPO + counsel |
| R6 | Advertising law and licensing — including markets that license commercial advertising or live selling | Directly drives the D7 Policy Engine's per-country rule set; **some markets may require an advertiser permit**, which is a seller-onboarding requirement, not a platform toggle | Counsel per market |
| R7 | Sector-restricted categories (alcohol, tobacco, pharma, firearms, financial services, gambling, adult) | Category × country rules are the Policy Engine's actual content; needed **before** launch for launch markets only | Counsel per market |
| R8 | Payments, money transmission, merchant-of-record, and the platform's legal role | **The reason F3b is Phase 2.** Deciding the transaction-fee model without deciding the legal role would be backwards. The 10% example is explicitly not approved | Counsel + finance |
| R9 | Tax: VAT/GST on cross-border digital services (package sales), e-invoicing mandates, withholding | Applies to MVP from the first package sale, even with no transaction commission | Tax advisor per market |
| R10 | Sanctions and export-control screening of sellers and target markets | Feeds the Policy Engine's deny paths; the one legitimate basis for blanket blocking under Principle 10 | Compliance |
| R11 | Recording and interception law | Relevant to CR-01's evidence buffer and to any future AI transcription of live sessions | Counsel per market |
| R12 | Accessibility requirements | Live captions may be mandated in some markets; currently unscoped in MVP | Counsel + product |

---

## 10. What the matrix could not decide

Three MVP-blocking inputs are **not** engineering decisions and are on the critical path:

| # | Input | Needed by | Blocks |
|---|---|---|---|
| 1 | **Beachhead selection** — which region cluster and which 3 categories | Before build starts | I4 (AR/EN), R6/R7 legal research scope, PSP selection (I1), Market Hours design, moderation language coverage (G4) |
| 2 | **CR-01 decision** (moderation evidence buffer) | Before G2/G3 build | Whether the MVP can operate a defensible moderation function at all — see §11 |
| 3 | **CR-02 decision** (in-app purchase vs. globally unified pricing) | Before C1/C2 build | Whether packages are web-only, and whether Principle 5 needs an explicit exception clause |

---

## 11. Change Requests and clarifications

### A. CR-01 — Short-lived moderation evidence buffer

**Conflicts with:** Principle 7 (data minimisation — *no video storage*).

**Request:** permit an encrypted, rolling **~120-second** buffer of live output, held **in memory or ephemeral
storage only**, purged automatically at session close, and retained beyond that **only** for the specific window
attached to an open abuse report, then purged on case closure. No general recording, no VOD, no replay surface, no
seller or viewer access, no analytics use, access limited to named moderators with an audit trail.

**Justification.** Without evidence, three things become impossible: (a) adjudicating a report fairly after the
stream has ended — which is when almost all reports arrive; (b) meeting the app stores' "prompt removal and
ejection" expectations with a defensible process; (c) responding to a lawful authority request or a wrongful
takedown appeal. A moderation function that can only act on what a moderator personally witnessed live is not
operable at 24/7 global scale, and it fails the seller too — an ejected seller has no basis for appeal.

**Impact if approved.** A bounded exception, not a reversal: still no VOD, no replay, no permanent storage, no
catalogue. Adds encryption-at-rest for the buffer, access control, an audit log, and an automated purge job with
purge attestation. Marginal cost, material legal protection.

**Impact if rejected.** G3 does not ship, and the MVP must accept: report adjudication limited to live-witnessed
events and automated classifier scores; weaker position with app review; weaker defence against both abusive sellers
and wrongful-takedown claims. If rejected, I recommend compensating by increasing automated classification sampling
and G4 staffing, and by documenting the limitation in the moderation policy — the risk does not disappear, it moves
to ops.

### B. CR-02 — App-store commission versus globally unified pricing

**Conflicts with:** Principle 5 (globally unified pricing for the same service) and Principle 13 (one sticker price
worldwide, differences only in top-up/FX/settlement).

**The collision.** If broadcast packages are ever sold through in-app purchase, the store takes ~15–30% and imposes
its own regional price tiers and FX behaviour. The *effective* price of the same tier then differs by country, and
the margin differs by platform. That is a breach of Principle 5 in substance even if the sticker price is nominally
unified.

**Requested decision — one of three:**

| Option | Description | My assessment |
|---|---|---|
| **A** (recommended) | **Web-only purchase.** App never sells; it displays entitlements and Go-Live. No purchase link in-app | Preserves Principles 5 and 13 exactly. Costs seller-onboarding conversion; the rate is unknown and should be measured, not guessed |
| **B** | Sell in-app where required, accept store price tiers | Breaches Principle 5 in effect. Would need an explicit approved exception clause: *"store-imposed regional tiers are a permitted deviation"* |
| **C** | Web-only globally, plus regional external-purchase-link entitlements where they exist | Highest compliance complexity and the least stable ground, since these entitlements are region-specific and actively changing. Revisit in Phase 2, not MVP |

**Recommendation: Option A for MVP**, revisit in Phase 2 with conversion data. Note this also happens to keep the
seller-side purchase flow on a surface where KYC document upload and invoicing are easier to operate.

### C. Clarifications requested — no principle change sought

1. **Scheduled Live cards are not a catalogue.** Confirm that a pre-announced upcoming broadcast card carrying only category, legal status, title, region and start time — expiring with the slot, conferring no ranking advantage — is within Principle 1. I believe it is: it advertises a *performance*, not a product. If the owner disagrees, B5 becomes a Change Request and the cold-start plan in §5 loses its strongest mechanism.
2. **A globally uniform, time-boxed launch promotion is not country-based pricing.** Confirm that a Founding Broadcaster discount offered worldwide on identical terms for an identical window is within Principle 5. A country-scoped version clearly is not, and is not being proposed.
3. **Per-tier concurrency ceilings are a service definition, not a price difference.** Confirm that differentiating tiers by concurrent-viewer ceiling is within Principles 5 and 13 — the same tier costs the same everywhere; tiers simply describe different services.
4. **"No default replay"** — confirm that no seller-side private quality/diagnostic artefact of any kind is expected. The MVP assumes none exists (H3), which is the strictest reading.

---

## 12. Open-question ledger

| Baseline open question | Status after this document | Who decides next |
|---|---|---|
| MVP scope | **Closed** — §3, pending CR-01/CR-02 and the beachhead decision | Owner sign-off |
| Identity & KYC rules | **Closed for MVP** — self-declared status + tier-1 document review for Business/Company/International (A2, A3). Full framework stays with the deferred AML/KYC workstream | Owner + counsel |
| Go-Live flow | **Closed for MVP** — B1 | Owner |
| Package design (duration / sessions / seats / geo) | **Informed, not closed** — §6.3 adds *concurrency ceiling* as a required tier variable; the numbers are the packaging deliverable | Next deliverable |
| Discovery UX | **Closed for MVP** — D1, D2 v0, D3, honest empty state; search deferred with a trigger | Owner |
| Live interaction (chat / voice / video guest) | **Closed for MVP** — text chat only (E1); guest voice/video Phase 3 | Owner |
| Invoice / refunds / settlement | **Partially closed** — package refunds in MVP (C7); invoicing Phase 2 (F3a); settlement Phase 2+ (F3b) | Counsel first (R8), then product |
| Transaction fee vs. platform legal role | **Deliberately still open** — and removed from the MVP critical path. The 10% figure remains **not approved** | Counsel + owner |
| Boost mechanics / Qualified View / frequency caps | **Open** — Phase 2, with a trigger | Next deliverable |
| Moderation automation level | **Closed for MVP** — automated screening + kill switch + 24/7 human queue (G2, G4) | Owner, and CR-01 |
| Data retention | **Recommended** — §7; every row needs per-country validation | Counsel |
| AI boundaries during live sessions | **Still open** — must close before I5 is built | Owner + counsel (R11) |
| Streaming architecture (WebRTC / LL-HLS / hybrid) | **Directional recommendation only** — §13. Full comparison is a separate deliverable | Next deliverable |
| Low-connectivity support | **Split** — 360p rung in MVP (B3); audio-only Phase 2 with a trigger (B4) | Owner |

---

## 13. Directional note on streaming architecture

Not a substitute for the full comparison, but the MVP cannot be built without a working assumption.
[My Recommendation], all of it, and all subject to the separate WebRTC vs. LL-HLS deliverable.

| Aspect | Working assumption for MVP |
|---|---|
| Shape | **Hybrid.** WebRTC for ingest and for the interactive low-latency tier; LL-HLS for scale-out fanout |
| Switch point | Promote a session to LL-HLS fanout above a concurrency threshold (order of a few hundred viewers) — WebRTC fanout cost per participant-minute is the dominant cost risk in this model |
| Latency target | Sub-second for the interactive tier; **2–5 s glass-to-glass** for the LL-HLS tier. A live commerce interaction survives 3 s; it does not survive 20 s |
| ABR ladder | 360p / 480p / 720p, **default 480p** (§6.3) |
| Ingest resilience | Uplink test in the Go-Live pre-flight (B1); auto-degrade before dropping |
| Deliberate non-goal | No origin recording, no VOD packaging, no storage bucket (H3) |

Latency targets are a commercial decision as much as a technical one — they set the cost floor. Both should be
signed off together in the architecture deliverable, not separately.

---

## 14. Launch-gate checklist

The MVP is not shippable until every row is true.

| # | Gate | Evidence |
|---|---|---|
| 1 | All P0 items delivered at their stated minimum tier | §3.1 walkthrough |
| 2 | CR-01 and CR-02 decided and implemented as decided | Owner sign-off recorded |
| 3 | Policy Engine loaded with real category × country rules for launch markets | Counsel sign-off per launch market (R6, R7, R10) |
| 4 | 24/7 moderation rota staffed, trained, with a tested escalation path | Rota + drill record |
| 5 | Negative-principle assertions pass in CI | Automated tests: no replay endpoint; no likes/gifts/tips; no follower or reaction counters; ranking module cannot read commerce tables; no "Verified" affordance; purge jobs verified |
| 6 | Retention and purge jobs verified end-to-end | Purge attestation logs for lead data, chat, and the evidence buffer |
| 7 | App-store review path rehearsed | Review-mode demo broadcast + demo account; age rating and permission strings confirmed |
| 8 | Delivery-cost telemetry emitting; cost ceilings enforced | Bytes and transcode-seconds per session; concurrency ceilings and auto-degrade tested under load |
| 9 | Package tiers priced at or above the §6.3 floor | Pricing model reviewed against vendor quotes, not against §6.1 assumptions |
| 10 | Tax and invoicing correct for package sales in launch markets | Tax advisor sign-off (R9) |
| 11 | Cold-start mechanisms live: Market Hours, Founding Broadcasters recruited, schedule populated | ≥5 concurrent per category × region during Market Hours in a dry run |
| 12 | Beachhead decision recorded | Owner sign-off |

---

## 15. Phase-2 entry criteria

Do not start Phase 2 on a date; start it on evidence. If the §5 liquidity targets are unmet, the correct response is
to narrow the beachhead further, not to add features.

| Criterion | Threshold |
|---|---|
| Liquidity | §5 targets met in ≥1 category × region cluster for 4 consecutive weeks |
| Revenue | Month-2 package renewal ≥40%, and delivery cost ≤30% of package revenue |
| Safety | Report backlog within SLA; no unresolved category of abuse that automated screening cannot detect |
| Cost | Cost per viewer-hour within 25% of the §6.2 model, with real vendor invoices |
| Demand signal | A named Phase-2 pull-forward trigger from §4 has actually fired |

---

## Appendix — verdict summary

| Verdict | Count | Items |
|---|---|---|
| **MVP — P0** | 25 | A1, A2, A3, A4(schema), B1, B2, B3, C1, C2, C3, C7, D1, D2(v0), D3, D7, E1, G1, G2, G3*, G4, H2, H3, I1, I2, I6 (+I3 fields) |
| **MVP — P1** | 6 | B5, E2, F2, H1, G5(hooks), I4(conditional) |
| **Phase 2** | 12 | A5, A6, B4, C4, C5, D4, D6, F3a, F3b, H4, I3, I5 |
| **Phase 3 / hold** | 4 | B6, D5, E3, F4 |
| **Out by principle** | — | §4 list |
| **Out by deferral** | — | §4 list |

`*` G3 conditional on CR-01.
