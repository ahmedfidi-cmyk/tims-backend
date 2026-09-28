# LIVE MARKET — Boost Mechanics: Qualified View, Pricing & Frequency Caps

| | |
|---|---|
| **Document type** | Mechanism design |
| **Baseline** | LIVE MARKET approved baseline, 27 September 2026 |
| **Date** | 2026-09-28 |
| **Prepared by** | Senior Product Consultant & Solution Architect |
| **Status** | Recommendation — Phase 2 capability, but §3 must be built into the MVP data model or it cannot be retrofitted |
| **Closes** | What Boost is · impression provenance · Qualified View definition · pricing unit and rate · frequency and density caps · inventory rationing · budget mechanics · LM boundary |
| **Does not close** | Final rate (awaits measured `v_h`) · advertiser reporting UI · whether an auction is ever permitted (§11) |
| **Depends on** | [Scope matrix](./mvp-scope-decision-matrix.md) C4, D2, D3 · [Financial model](./financial-model.md) parameter register · [Discovery UX](./discovery-ux-spec.md) §3 |

> **Tag legend** — **[Approved]** baseline · **[Open]** baseline-declared open question · **[Deferred]** outside the
> baseline's design surface · **[My Recommendation]** consultant judgement, rejectable without touching the baseline.

---

## 1. What Boost is, and what it must never be

| Boost **is** | Boost is **not** |
|---|---|
| Paid **impressions** — additional placements of a live broadcast in the grid | A ranking signal |
| Labelled and visibly distinguishable | A way to raise organic position |
| Bounded by density and frequency caps | A claim on the Discovery Allocation floor |
| Charged per **delivered attention**, not per pixel | An auction (§11) |
| Available to every seller on identical published terms | A tier benefit or a package inclusion |

Principle 6 fixes the organic ranking signals and makes them sales-blind. Principle 2 makes broadcasting itself the
paid product. Boost therefore sits **beside** the organic system, buying placement volume, and the entire design
problem is keeping the two from leaking into each other.

---

## 2. Boost must not be bundled, ever

Already established in [pricing](./package-structure-and-pricing.md) §11 and restated because it is the single
easiest thing to get wrong later: **Boost is a separate prepaid campaign budget.** It is never a tier inclusion, never
a volume perk, never "500 free Boost credits with Business". Bundling amplification into a subscription tier makes
reach a subscription benefit, which is a Principle 6 breach identical to selling ranking directly.

---

## 3. The contamination problem — the core of this document

**This is the mechanism that decides whether Principle 6 survives Boost.**

Organic ranking uses Unique Viewers, Retention/Watch Time, Momentum and Unique Shares (matrix D2). A boosted broadcast
receives more impressions, therefore more unique viewers, therefore more watch time and momentum. If those views feed
the organic signals, then **paid reach buys organic reach** — indirectly, invisibly, and irreversibly. Principle 6
would be nominal within a quarter.

### 3.1 The fix: impression provenance

Every impression, and every view resulting from it, carries its **source**:

| Provenance | Meaning |
|---|---|
| `organic` | Delivered by the ranking system |
| `allocation` | Delivered by the Discovery Allocation floor for new broadcasts (D3) |
| `boost` | Delivered by a paid campaign |
| `direct` | Deep link, share link, Remind-me notification, schedule card |

**Rule 1 — organic signals are computed on `organic` and `direct` views only.** `boost` views are excluded from Unique
Viewers, Retention, Momentum and Unique Shares. A boosted broadcast's organic standing is exactly what it would have
been unboosted.

**Rule 2 — `allocation` views are also excluded.** The Discovery Allocation floor exists to give new broadcasts a
fair first hearing; if its views fed Momentum, the floor would become a launch catapult and new-broadcast fairness
would turn into a new-broadcast advantage.

**Rule 3 — Boost may never occupy an `allocation` slot.** The floor is reserved, unpurchasable inventory.

### 3.2 Why this must exist before MVP ships

Provenance is a field on the view record and a discipline in the metering path. Adding it later means backfilling
every historical signal, and more importantly it means shipping a period during which ranking was contaminated and
nobody can say by how much. **[My Recommendation]: the provenance field ships at MVP even though Boost is Phase 2.**
It costs one enum; retrofitting it costs the credibility of every ranking number computed before the change.

### 3.3 One mechanism, three jobs

The same provenance record that protects ranking also answers two commercial questions:

| Job | How provenance serves it |
|---|---|
| Ranking integrity | §3.1 |
| **Boost billing** | Only `boost`-sourced views are billable Qualified Views |
| **Package accounting** | §5.2 — boosted viewer-hours are billed to the campaign, not to the seller's package allowance |

---

## 4. Qualified View

A commercial unit with money attached must be precise, auditable and published. Vague ad metrics are how advertisers
stop trusting a platform.

### 4.1 Definition [My Recommendation]

A **Qualified View** is counted when **all** of the following hold:

| # | Condition | Rationale |
|---|---|---|
| QV1 | Provenance is `boost` | Organic reach is not billable |
| QV2 | Playback actually started and ran **≥10 continuous seconds** at ≥360p | Proof of delivered attention, not a rendered tile. Below ~10 s it is a scroll-past; above ~30 s it under-counts genuine sampling, which in live commerce is short and frequent |
| QV3 | Unique per **viewer-device per broadcast per 24 h** | Prevents a single viewer re-entering from billing repeatedly |
| QV4 | Not the seller's own device or account | |
| QV5 | Not flagged as suspected synthetic traffic | §8 — measurement hygiene, not enforcement |
| QV6 | Delivered in a market permitted for that campaign by the Policy Engine | Principle 11 |

**Not a Qualified View:** a grid impression, a poster-frame render, a sub-10-second entry, a repeat entry within 24 h,
or any view delivered after the broadcast ended.

### 4.2 Why a delivered-attention unit rather than a CPM

A CPM pays for a chance to be seen. A Qualified View pays for **ten seconds of a real human watching a live seller**.
For a live-only market this is a strictly better unit: it is closer to the value actually produced, it is far harder
to inflate with placement tricks, and it aligns the platform's incentive with viewer relevance rather than impression
volume. It also means the platform cannot profit from junk placements, since a junk placement produces no QV.

---

## 5. Pricing

### 5.1 A fixed global rate, not an auction

Principle 5 requires globally unified pricing for the same service, and Principle 13 one sticker price worldwide.
**An auction is structurally incompatible with that**: its whole function is to produce different clearing prices in
different markets at different times. See §11 for the Change Request an auction would require.

[My Recommendation] **One published global price per Qualified View**, identical in every market, on the rate card
(pricing §8). Demand imbalance is handled by **rationing inventory** (§7), not by moving price.

### 5.2 The rate must include delivery — and here is the trap it avoids

Derived from the [financial model](./financial-model.md) register; the parameters are not restated here, only used.

```
DeliveryCostPerQV ≈ v_h × (average boosted watch minutes ÷ 60)
```

At the register's Launch `v_h` and an assumed 8-minute average boosted watch, that is roughly **$0.002 per QV**.
Applying the serving-cost floor gives a rate of about **$0.01 per Qualified View — i.e. $10 per 1,000 QV.**

**The trap this avoids.** If boosted viewer-hours drew down the *seller's package allowance*, a well-performing Boost
campaign would consume the allowance faster, and at the ceiling **the broadcast the campaign was promoting would end**
(seller PRD S8 ending 4). The advertiser would have paid to terminate their own broadcast. So:

> **Boosted viewer-hours are billed to the campaign, never to the package allowance.** The Boost price includes
> delivery of the viewers it brings.

This is only implementable because of provenance (§3.3). It is also the reason the rate cannot be set by comparison
with ad-market CPMs alone — it carries a delivery obligation a CPM does not.

### 5.3 Parameters added to the register

| Symbol | Parameter | Launch value | Source |
|---|---|---|---|
| `p_qv` | Price per Qualified View | **$0.010** | This document, §5.2 |
| `w_b` | Average boosted watch minutes | **8** | Assumed — measure in the pilot |
| `c_qv` | Delivery cost per QV = `v_h × w_b/60` | **≈$0.002** | Derived |

Added to [financial-model.md](./financial-model.md) §1 in the same change, per its change-control rule.

---

## 6. Frequency and density caps

Caps are not a courtesy to viewers; they are what keeps the market from reading as an ad network.

| # | Cap | Recommended value | Why |
|---|---|---|---|
| F1 | Per viewer, per campaign, per day | **3 QV** | Beyond this, repetition annoys without informing |
| F2 | Per viewer, per campaign, per hour | **1 QV** | Prevents burst harassment within a browse session |
| F3 | Per viewer, total boosted share of grid tiles seen | **≤20%** | The market must feel organic. Past roughly a fifth, it does not |
| F4 | **Grid density** — boosted share of all impressions served, platform-wide | **≤20%** | The systemic version of F3; the number that keeps Principle 6's fairness real rather than nominal |
| F5 | Per advertiser, share of total boosted inventory in a category × region | **≤25%** | One large advertiser must not be able to buy the category |
| F6 | Minimum organic floor per grid page | **No page is majority boosted** | A hard structural guarantee, not a statistical one |

**F4 and F5 are the load-bearing ones.** F1–F3 protect the individual viewer's experience; F4 and F5 protect the
market's character and the credibility of organic ranking. They also cap Boost revenue — deliberately. An uncapped
Boost business would eventually out-earn broadcasting packages, and at that point the platform's incentives quietly
invert against Principle 6.

---

## 7. Inventory without an auction

Fixed price plus finite inventory means rationing. That is a solvable problem, and more predictable for advertisers
than bidding.

| # | Mechanism |
|---|---|
| I1 | Boost inventory per category × region × time window is computed from projected organic impressions and the F4 density cap |
| I2 | Campaigns reserve against that inventory, first-come, subject to F5 |
| I3 | When a window is full, the advertiser sees **availability**, not a higher price — they pick another window or another region |
| I4 | **Boost cannot create inventory that does not exist.** In an empty market there is nothing to amplify, and no budget may be spent. Boost is a demand multiplier, never a demand source |
| I5 | Unspent reserved budget is released back, never forfeited |

**I4 matters for launch sequencing.** Boost is useless before liquidity exists — it multiplies attention that already
exists. This is an independent reason it is Phase 2, on top of the matrix's build-cost reasoning.

---

## 8. Budget mechanics

| # | Rule |
|---|---|
| B1 | Prepaid campaign budget, consistent with the prepaid package model (pricing §6) |
| B2 | **Spend stops the instant ingest stops.** Principle 1 has no grace period, and neither does the meter. No QV is billable after the broadcast ends |
| B3 | Daily and total caps, both advertiser-set, with the total cap mandatory |
| B4 | Policy Engine region removal (Principle 11): budget **reallocates to the permitted regions**, it is never silently spent in a removed region and never forfeited. The campaign is never rejected |
| B5 | Suspected-synthetic QV are **not billed** (QV5). This is measurement hygiene — the platform declining to charge for traffic it does not trust — and is distinct from enforcement against a person, which stays [Deferred] under Principle 14 |
| B6 | Spend is reported to the advertiser in QV, delivered minutes and regions — never per-viewer rows (Principle 7) |
| B7 | A campaign may target category, region and language. **It may never target an individual viewer** or a viewer-derived audience segment |

B7 is worth stating explicitly: behavioural ad targeting is the natural next step for any ad product and it would
require a viewer profile the platform deliberately does not keep (Principle 7, discovery §7).

---

## 9. LM rewards inside a campaign

| # | Rule |
|---|---|
| L1 | Viewer LM rewards are funded **from the advertiser's campaign budget**, never from platform subsidy — Principle 13 [Approved] |
| L2 | A campaign budget therefore has two lines: **impressions** and **optional viewer rewards** |
| L3 | LM is only awarded against a Qualified View, so junk traffic cannot mint rewards |
| L4 | A suspected-synthetic QV (QV5) earns no LM and bills nothing |
| L5 | LM remains a **non-transferable, non-cashable internal ledger entry** with no off-platform exit (pricing §2) — wallet, custody and transferability stay [Deferred] |
| L6 | **Natural human LM-collecting behaviour is never treated as abuse** (Principle 14). A viewer who watches a lot of live commerce and collects a lot of LM is the intended user, not a threat |

---

## 10. Negative acceptance criteria

| # | Assertion |
|---|---|
| N1 | Boost-sourced views are excluded from every organic ranking signal computation |
| N2 | Allocation-sourced views are excluded from every organic ranking signal computation |
| N3 | No Boost campaign can be served into a Discovery Allocation slot |
| N4 | The ranking module cannot read campaign, budget or spend tables |
| N5 | Boosted impressions are labelled on every surface that serves them |
| N6 | No grid page is majority boosted (F6), and platform density stays ≤F4 |
| N7 | No campaign parameter accepts a viewer identifier or a viewer-derived segment |
| N8 | Zero QV are billable for playback beginning after ingest stopped |
| N9 | Boosted viewer-hours never decrement a seller's package allowance |
| N10 | Boost appears in no package tier definition or entitlement record |

---

## 11. If an auction is ever wanted — the Change Request it needs

**Not requested.** Recorded so it cannot arrive as an optimisation.

An auction would raise Boost yield and self-balance demand. It would also mean the same service clears at different
prices in different markets, which is the substance of what Principles 5 and 13 forbid, whatever the mechanism's name.

| If pursued | Required |
|---|---|
| Change Request against Principles 5 and 13 | With an explicit exception clause: *"market-clearing prices for amplification inventory are a permitted deviation from unified pricing"* |
| Impact statement | Advertisers in high-demand markets pay more for identical reach; the published rate card ceases to describe what anyone actually pays |
| My assessment | **Do not pursue.** Fixed price plus rationing (§7) is less efficient and more honest, and honesty about price is a load-bearing part of this baseline's identity |

---

## 12. Open items and assumptions

| # | Item | Owner |
|---|---|---|
| 1 | Confirm `p_qv` = $0.010 once `v_h` and `w_b` are measured | Owner + finance |
| 2 | Confirm the QV playback threshold at 10 s | Owner + data, from pilot distribution |
| 3 | Confirm density cap F4 at 20% | Owner — a values decision about how the market should feel |
| 4 | Accept the provenance field into the MVP data model (§3.2) | Owner — **the only MVP-affecting ask in this document** |
| 5 | Advertiser reporting surface | Product, Phase 2 |
| 6 | Whether Boost is offered to Individual sellers or only Business+ | Owner — note that restricting it would make reach status-dependent, which brushes against Principle 6 |

| # | Assumption | Validate with |
|---|---|---|
| A1 | 8-minute average boosted watch | Pilot |
| A2 | A 10-second threshold separates sampling from scroll-past | Pilot playback distribution |
| A3 | 20% density is the point where a market stops feeling organic | Viewer research; there is no universal number |
| A4 | Fixed-price inventory can be rationed without persistent shortage | Phase-2 demand data |
