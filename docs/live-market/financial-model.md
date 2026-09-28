# LIVE MARKET — Consolidated Financial Model

| | |
|---|---|
| **Document type** | Financial model — **single source of truth for unit costs** |
| **Baseline** | LIVE MARKET approved baseline, 27 September 2026 |
| **Date** | 2026-09-27 |
| **Prepared by** | Senior Product Consultant & Solution Architect |
| **Status** | Recommendation — every parameter is assumed until the PoC and pilot measure it |
| **Precedence** | **Where any other document in this workstream states a cost, margin or break-even figure that conflicts with this one, this document wins.** The others describe *why* a number exists; this one holds the number |
| **Closes** | Parameter register · cost equations · three scenarios · sensitivity ranking · break-even reality check · change control |
| **Does not close** | Boost and Phase-2 transaction revenue (excluded, §8) · funding requirement and cash runway · headcount beyond the moderation rota |

> **Why this document exists.** Across four deliverables the cost model was amended three times: `v_h` arrived with
> the streaming architecture, `M_h` with the moderation model, and the fixed-cost base was revised upward twice. Each
> amendment was correct and documented, but the consequence is that **the true number now lives in three places**.
> Anyone who recomputes from one document alone reaches a different answer than anyone who reads all four. This closes
> that debt before the pack reaches a team, a lender or an investor.
>
> **Standing caveat.** Every parameter below is a planning assumption requiring validation against real vendor quotes,
> real recruitment costs, and real pilot behaviour. Tax, licensing and payment-fee treatment require specialised
> per-country validation. Nothing here is financial, tax or legal advice.

---

## 1. Parameter register

The authoritative values. Everything downstream is derived.

| Symbol | Parameter | Launch value | Target value | Source | Status |
|---|---|---|---|---|---|
| `F_h` | Transcode ladder + packaging + origin, per **stream-hour** | **$0.20** | $0.20 | [Streaming](./streaming-architecture-webrtc-vs-llhls.md) §4 | Assumed |
| `M_h` | Moderation compute (vision sampling + ASR), per **stream-hour** | **$0.15** | $0.10 | [Moderation](./moderation-operating-model.md) §4.3 | Assumed |
| `g` | GB per viewer-hour, **blended across the ladder** | **0.50** | 0.50 | Streaming §6.2 | Assumed mix |
| `c_gb` | CDN egress, per GB | **$0.030** | $0.020 | Streaming §4 | Assumed — on-demand vs. committed |
| `v_h` | Egress per **viewer-hour** = `g × c_gb` | **$0.015** | $0.010 | Derived | Derived |
| `psp` | Payment processing, % of revenue | **3.0%** | 2.5% | [Pricing](./package-structure-and-pricing.md) §12 | Assumed |
| `Fix_mod` | Moderation rota, ~15 FTE, per month | **$35,000** | $35,000 | Moderation §6.3 midpoint | Assumed |
| `Fix_plat` | Control plane, database, Redis, chat service, per month | **$500** | $500 | Infrastructure answer, this workstream | Assumed |
| `Fix` | Total modelled fixed cost, per month | **$35,500** | $35,500 | Sum | — |
| `r` | Monthly repurchase / renewal rate | **Unknown** | ≥0.85 (§7) | — | **The critical unknown** |
| `p_qv` | Price per Qualified View (Boost, Phase 2) | **$0.010** | $0.010 | [Boost](./boost-mechanics.md) §5.2 | Assumed |
| `w_b` | Average boosted watch minutes | **8** | 8 | Boost §5.2 | Assumed |
| `c_qv` | Delivery cost per QV = `v_h × w_b/60` | **≈$0.002** | ≈$0.0013 | Derived | Derived |

**Explicitly not in `Fix`:** engineering, product, design, founders, legal, marketing spend, office. `Fix` is the
**operating floor the product itself creates** — the cost of keeping the market open and safe for one month with zero
sellers. Add organisation cost separately when building a funding model.

**Note on `g`.** The 480p default rung alone is **0.56** GB/viewer-hour; 360p is 0.38 and 720p is 1.17 (streaming
§6.2). `g` = 0.50 is a blended-mix assumption, not a rung. It is the least-examined number in this register and it
scales the largest variable cost line, so it is priority 4 to measure (§11).

---

## 2. Cost equations

```
v_h              = g × c_gb
ServingCost(t)   = (F_h + M_h) × H(t)  +  v_h × VH(t)
GrossMargin(t)   = (P(t) − ServingCost(t)) / P(t)
Contribution(t)  = P(t) − ServingCost(t) − (psp × P(t))
BlendedContrib   = Σ mix(t) × Contribution(t)
BreakEvenSellers = Fix / BlendedContrib
SteadyStateSellers = GrossMonthlyAdds / (1 − r)
```

Where `H(t)` is the tier's broadcast hours and `VH(t)` its included viewer-hours (pricing §4).

**Overage is accretive and deliberately so.** Each 1,000 overage viewer-hours bills $50 against $15 of cost —
**+$35 contribution**. A seller whose broadcast outgrows its allowance improves unit economics rather than eroding
them, which is the entire point of metering the audience instead of capping it.

---

## 3. Three scenarios

Tier definitions from pricing §4: Starter 10 h / 500 vh / $29 · Growth 40 h / 1,600 vh / $99 · Business 150 h /
6,800 vh / $399 (Phase 2).

### 3.1 Launch — on-demand CDN, premium-ish moderation compute

`F_h + M_h` = $0.35 · `v_h` = $0.015 · `Fix` = $35,500

| Tier | Serving cost | Gross margin | Contribution | 3× floor | Price | vs. floor |
|---|---|---|---|---|---|---|
| Starter | $11.00 | 62.1% | **$17.13** | $33.00 | $29 | −12% |
| Growth | $38.00 | 61.6% | **$58.03** | $114.00 | $99 | −13% |
| Business | $154.50 | 61.3% | **$232.53**¹ | $463.50 | $399 | −14% |

¹ $399 − $154.50 serving − $11.97 `psp`. The $255.03 in pricing §12 predates `M_h` and is superseded.

### 3.2 Target — committed CDN, adaptive sampling matured

`F_h + M_h` = $0.30 · `v_h` = $0.010 · `Fix` = $35,500

| Tier | Serving cost | Gross margin | Contribution | vs. 3× floor |
|---|---|---|---|---|
| Starter | $8.00 | **72.4%** | $20.13 | Clears ($24.00) |
| Growth | $28.00 | **71.7%** | $68.03 | Clears ($84.00) |
| Business | $113.00 | **71.7%** | $274.03 | Clears ($339.00) |

**The Target scenario restores the 3× floor at the current sticker prices.** This is the case for holding prices
(pricing §13.3 option B): the floor is recovered by procurement and engineering, not by charging sellers more.

### 3.3 Stress — worst-case unit costs

`F_h` = $0.38 · `M_h` = $0.25 · `v_h` = $0.040 · `Fix` = $52,500

| Tier | Serving cost | Gross margin | Contribution |
|---|---|---|---|
| Starter | $26.30 | **9.3%** | $1.83 |
| Growth | $89.20 | **9.9%** | $6.83 |
| Business | $366.50 | **8.1%** | $20.53 |

Blended contribution collapses to **$4.52**, and break-even to **~11,600 sellers** — which is to say the price ladder
is **not viable at all** under worst-case unit costs.

**Read this scenario as the finding it is:** securing a committed CDN rate and low-cost moderation inference is not an
optimisation task to schedule later. It is existential, and it belongs on the critical path beside the beachhead
decision.

---

## 4. Break-even

| Tier mix | Blended contribution | Break-even sellers |
|---|---|---|
| **MVP only** — 65% Starter / 35% Growth, Launch costs | $31.44 | **~1,130** |
| MVP only — Target costs | $36.89 | ~960 |
| **With Phase 2** — 60/35/5 including Business, Launch costs | $42.22 | **~840** |
| With Phase 2 — Target costs | $49.59 | ~715 |

### The finding that matters most here

**The MVP tier ladder alone cannot plausibly reach break-even.** ~1,130 paying sellers in a beachhead of three
categories in one region cluster is not a launch-year number. Adding the Business tier cuts the requirement by ~26%,
and Target unit costs cut it by another ~15%.

**Consequence:** Phase 2 (broadcaster seats, A5/A6) is not merely a customer request to be triggered by an enterprise
anchor signing — as the scope matrix frames it. **It is a P&L requirement.** This adds a second, independent trigger
for Phase 2 that the matrix does not carry: *the financial model does not close without it.* [My Recommendation] —
see §9.2.

---

## 5. Sensitivity — what actually moves the answer

±30% on each parameter (±10% on price, since a 30% price move is a different product), measured against the
Phase-2-mix Launch baseline of $42.22 blended contribution and ~840 break-even sellers.

| Rank | Parameter | Down | Up | Break-even range | Impact on break-even |
|---|---|---|---|---|---|
| **1** | `Fix` — dominated by the moderation rota | $24,850 | $46,150 | **590 ← → 1,095** | **−30% / +30%** |
| **2** | Price (±10%) | −10% | +10% | **1,010 ← → 720** | +20% / −14% |
| **3** | `v_h` — CDN egress | $0.0105 | $0.0195 | **745 ← → 965** | −11% / +15% |
| **4** | Tier mix (+10 pts Starter→Growth) | — | — | **765** | −9% |
| **5** | `M_h` — moderation compute | $0.105 | $0.195 | **815 ← → 865** | −3% / +3% |

### Two conclusions that correct earlier emphasis

**1. The moderation *rota* dominates; the moderation *compute* barely registers.** `M_h` was the alarming finding in
the moderation document — and it was correct and material for the price-floor rule, because it pushed all three tiers
below 3×. But for break-even it is the **weakest** of the five levers, while headcount is the strongest by a wide
margin. Both facts are true; they answer different questions. If you can only work one moderation lever, work the rota's
**cost per FTE** — location and in-house-vs-BPO — and only secondarily the supervision ratio, which the two-person
off-peak floor caps at roughly a 14% saving (§8). The inference bill is the least of the three.

**2. Price is the second-strongest lever, and it is the one already declined.** Pricing §13.3 recommended holding
prices to buy launch supply. That remains my recommendation, but this table is the cost of that choice stated
precisely: a 10% price rise would remove ~120 sellers from the break-even requirement, and a 10% cut would add ~170. It is a real trade, not a free
one.

---

## 6. Revenue mix sanity

| Line | Modelled? | Note |
|---|---|---|
| Package revenue | **Yes** | The only revenue in this model |
| Viewer-hour overage | Partially | Accretive at +$35 per 1,000 vh (§2); not forecast, because it depends on unmeasured audience distribution |
| Broadcast-hour overage | No | Small; $1.00 against $0.35 cost |
| Boost (Phase 2) | **No** | Still excluded. The mechanics are now designed ([Boost](./boost-mechanics.md)) and its parameters are in §1, but Phase-2 demand is unmeasured and the density caps (Boost §6) deliberately bound the revenue. Upside not counted |
| Transaction fee (Phase 2, F3b) | **No** | Deliberate — the platform's legal role is [Open] and the 10% example is **not approved**. Modelling revenue from an undecided legal structure would be the worst kind of optimism |
| LM | **No** | [Deferred] workstream |

**Everything excluded is upside.** That is the right asymmetry for a plan: the model should stand on the revenue line
the baseline already commits to (Principle 2, paid broadcasting), and treat the rest as improvement.

---

## 7. Retention is the binding constraint, not acquisition

This is the most important section in the document, and it corrects a target set earlier in the workstream.

Steady-state paying sellers = gross monthly adds ÷ (1 − `r`), where `r` is the monthly repurchase rate. To hold
**840** paying sellers:

| Monthly repurchase rate `r` | Average paying months | Gross adds needed **per month** |
|---|---|---|
| 0.40 | 1.7 | **504** |
| 0.60 | 2.5 | 336 |
| 0.75 | 4.0 | 210 |
| **0.85** | **6.7** | **126** |
| 0.90 | 10.0 | 84 |

### The correction

The pricing document and the scope matrix set a target of **"≥40% month-2 renewal"**. Against this model, 40% monthly
repurchase requires acquiring **~500 new paying sellers every month, forever**, merely to stand still at break-even.
No plausible acquisition engine for a cold-start live marketplace delivers that.

**The required target is `r` ≥ 0.85 monthly.** I am withdrawing the 40% figure: it was set as a floor for "is anyone
coming back", not derived from what the P&L needs, and it is not a viable business target. [My Recommendation]

**This reframes the whole growth problem.** The scope matrix treats cold-start — getting supply to show up — as the
central risk. It is the *first* risk. The *binding* one is getting supply to come back, which means the seller must
get outcomes worth repurchasing for. Which in turn means:

| Lever | Why it now matters more than it appeared to |
|---|---|
| Seller statistics (matrix H1) | The only evidence of value a seller has. Already P1 — arguably P0 |
| Lead Generation mode (F2) | Exposure Only gives a seller nothing to point at when deciding to repurchase |
| Discovery Allocation (D3) | A seller with no audience does not return, whatever the product's principles are |
| Invoice issuance (F3a, Phase 2) | Converts an outcome into a recorded outcome |
| Rollover of unused hours (Phase 2) | Pricing §6 named no-rollover as a churn risk. In this light it is a direct attack on `r` |

---

## 8. What would structurally change the picture

| # | Change | Effect | Status |
|---|---|---|---|
| 1 | Committed CDN contract (`c_gb` → $0.020) | Blended contribution +14%, break-even −12% (~735) | Procurement, immediate |
| 2 | Business/Enterprise mix reaching 5–10% | Break-even −26% or better | Phase 2 (A5/A6) — now a P&L requirement (§4) |
| 3 | Supervision ratio up from 6 to 10 via automation maturity | `Fix_mod` down only ~14% — the two-moderator off-peak floor caps the saving, since off-peak is staffed for safety rather than for load | Worth doing, smaller than it looks |
| 4 | **Cost per moderator FTE** — location, in-house vs. BPO | The largest *achievable* lever: the $1,800–$3,500 range in moderation §6.3 is a ±35% swing on `Fix`, i.e. break-even from ~590 to ~1,095. Changes wellbeing governance, not the wellbeing requirements | Owner decision (moderation §14) |
| 5 | Boost revenue | Pure upside, unmodelled | Phase 2 |
| 6 | Transaction fee | Pure upside, unmodelled and legally undecided | Blocked on legal role |
| 7 | `r` from 0.40 to 0.85 | Reduces required monthly adds from ~500 to ~126 | **The whole ballgame (§7)** |

---

## 9. Amendments to other documents

### 9.1 Superseded figures

| Document | Figure as published | Superseded value | Cause |
|---|---|---|---|
| Pricing §5 | Delivery cost $9.50 / $32.00 / $132.00 | **$11.00 / $38.00 / $154.50** | `M_h` added (moderation §13) |
| Pricing §12 | Contribution $18.63 / $64.03 / $255.03 | **$17.13 / $58.03 / $232.53** | `M_h` added |
| Pricing §12 | Fixed base $25,000 | **$35,500** | Rota sized at ~15 FTE (moderation §6) |
| Pricing §12 | Break-even ~540 | **~840** with Phase 2, **~1,130** MVP-only | Both of the above |
| Pricing §5 | "Price floor ≥ 3 × delivery cost" | **≥ 3 × serving cost**, met in the Target scenario, ~2.6× at Launch | Moderation §13.1 |
| Pricing §5 / Matrix §5 | Month-2 renewal ≥40% | **Monthly repurchase ≥0.85** | §7 of this document |
| Moderation §13.2 | Blended break-even ~830 | **~840** | `Fix_plat` added; rounding |

### 9.2 Matrix §4 — a second Phase-2 trigger

The scope matrix gives A5/A6 (seats, multi-country concurrency) the pull-forward trigger *"one enterprise anchor
advertiser signs a letter of intent"*. Add a second, independent trigger: **the financial model does not close
without the Business tier** (§4). Phase 2 is therefore scheduled work, not demand-contingent work.

### 9.3 Matrix §15 — Phase-2 entry criteria

The matrix gates Phase 2 on liquidity and on month-2 renewal ≥40%. Replace the renewal criterion with **monthly
repurchase trending above 0.70 and improving**, and add **CDN commitment secured** as a criterion, since §3.3 shows
the plan is not viable without it.

---

## 10. Change control

This document is the source of truth. A parameter changes **here first**, then propagates.

| Parameter | Documents that consume it |
|---|---|
| `F_h`, `v_h`, `g`, `c_gb` | Streaming §4, §6 · Pricing §3, §5 |
| `M_h` | Moderation §4, §13 · Pricing §5 |
| `Fix_mod` | Moderation §6 · Pricing §12 |
| `psp` | Pricing §12 |
| Tier prices and allowances | Pricing §4 · Seller PRD S1, S4 |
| `p_qv`, `w_b`, `c_qv` | Boost §5 — Phase 2, and **not** included in the revenue model (§6) |
| `r` | Matrix §5, §15 · Pricing §12 |

**Rule** [My Recommendation]: no document in this workstream restates a number from this register. It references it.
A number that exists in two places will disagree with itself within a quarter — which is exactly what happened, and
what this document exists to stop.

---

## 11. What the PoC and pilot must measure

Ordered by how much the answer moves (§5).

| Priority | Measure | Replaces | Where |
|---|---|---|---|
| 1 | Moderator supervision ratio in practice | The 6–8 assumption driving `Fix_mod` | Pilot, first 4 weeks |
| 2 | Monthly repurchase rate `r` | The single critical unknown | Pilot, months 2–4 |
| 3 | Committed `c_gb` at projected volume | On-demand assumption | Vendor negotiation, now |
| 4 | Real blended `g` across the ladder | The 0.50 mix assumption — least examined, scales the largest variable line | Streaming PoC telemetry |
| 5 | `M_h` at the adaptive-sampling mix | $0.10–0.25 assumption | Streaming PoC + classifier vendor |
| 6 | `F_h` per stream-hour | $0.20 assumption | Streaming PoC invoices |
| 7 | Tier mix and overage distribution | 60/35/5 and "unmodelled" | Pilot |
| 8 | Loaded moderator cost in the chosen location | $2,600/month midpoint | Recruitment |

---

## 12. Open items

| # | Item | Owner |
|---|---|---|
| 1 | Pricing response to the floor shortfall — hold at ~62% (recommended) or raise ~20% | Owner |
| 2 | In-house rota vs. BPO — the largest single lever on break-even | Owner |
| 3 | Accept Phase 2 as scheduled rather than demand-contingent (§9.2) | Owner |
| 4 | Replace the 40% renewal target with ≥0.85 monthly repurchase (§7) | Owner |
| 5 | Funding requirement and runway — not modelled here; needs organisation cost added to `Fix` | Finance |
| 6 | Whether to model Boost and transaction revenue at all before their mechanics and legal role are decided | Owner — my recommendation is **no** |
