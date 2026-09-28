# LIVE MARKET — Seller Retention & Repurchase Programme

| | |
|---|---|
| **Document type** | Programme design + scope amendment request |
| **Baseline** | LIVE MARKET approved baseline, 27 September 2026 |
| **Date** | 2026-09-28 |
| **Prepared by** | Senior Product Consultant & Solution Architect |
| **Status** | Recommendation — contains a **scope amendment** the owner must accept or reject (§7) |
| **Closes** | Metric definitions · causal model of non-repurchase · the repurchase loop · forbidden tactics · instrumentation · 90-day pilot plan |
| **Does not close** | Win-back copy · pricing of rollover · auto-renew consent design (Phase 2) |
| **Exists because** | [Financial model](./financial-model.md) §7 — monthly repurchase, not acquisition, is the binding constraint, and nothing in the pack addressed it |

> **Tag legend** — **[Approved]** baseline · **[Open]** baseline-declared open question · **[Deferred]** outside the
> baseline's design surface · **[My Recommendation]** consultant judgement, rejectable without touching the baseline.

---

## 1. Why this document exists

The financial model established that at the 40% renewal figure carried by the pricing document and the scope matrix,
holding break-even requires acquiring ~500 new paying sellers **every month, forever**. The required figure is monthly
repurchase `r` ≥ 0.85.

Six deliverables in, nothing owns that number. The machinery that would produce it exists as scattered parts —
seller statistics at P1, Lead Generation at P1, hour rollover deferred to Phase 2, Scheduled Live at P1 — none of them
selected *for* retention, none measured against it. **This document makes `r` someone's job.**

---

## 2. Define the metric properly first

"Renewal" is the wrong word for a prepaid, non-recurring package model (pricing §6). A seller does not cancel; they
simply do not come back, and they may come back two months later. Measuring this as subscription churn produces
numbers that are both wrong and demoralising.

| Metric | Definition | Use |
|---|---|---|
| **APS** — active paying seller | Holds an unexpired package with remaining broadcast hours | The denominator for everything |
| **`r`** — monthly repurchase rate | Sellers who purchase again within 30 days of exhaustion or expiry ÷ sellers who exhausted or expired in the period | The financial model's parameter |
| **Lapse** | No active package for ≤60 days | Recoverable — win-back applies |
| **Churn** | No active package for >60 days | Treat as lost; measure reactivation separately |
| **90-day reactivation** | Lapsed sellers who return within 90 days | Prepaid models have real seasonality; ignoring it understates lifetime |
| **Activation** | First session reaching the §4.1 threshold | The leading indicator — available weeks before `r` is |
| **NRR** — net revenue retention | Contribution this month from sellers active last month ÷ their contribution last month | The honest headline, because upgrades and overage count |

**`r` alone is a trap.** A seller moving Starter → Growth retains 339% of their revenue; a seller adding 2,000 overage
viewer-hours adds $70 of contribution without appearing in `r` at all. NRR captures both. Use `r` for the model and
**NRR ≥ 100% as the target**.

### 2.1 Monetisation is only a partial substitute for retention

Holding gross adds at 126/month and `Fix` at $35,500, the required `r` falls as contribution per seller rises:

| Contribution per seller per month | Sellers needed | Required `r` |
|---|---|---|
| $42.22 (today's blend) | 841 | **0.85** |
| $50 | 710 | 0.82 |
| $60 | 592 | 0.79 |
| $75 | 473 | 0.73 |
| $100 | 355 | **0.65** |

**Read this honestly: upgrades and overage help, but they do not rescue the plan.** Even at $100 contribution per
seller — more than double today's blend — the business still needs two thirds of sellers repurchasing every month.
Retention cannot be engineered away by monetisation. It has to be earned.

---

## 3. Why a seller does not come back — diagnose before prescribing

Five failure modes, in the order they occur. Each needs a different response, and confusing them is how retention
programmes waste money.

| # | Failure | What the seller experienced | Correct response | Already in the pack? |
|---|---|---|---|---|
| **F1** | **No audience** | Paid, went live, talked to almost nobody | **Not a retention problem.** Marketplace liquidity — Discovery Allocation, Market Hours, beachhead concentration | Yes (matrix §5, D3) |
| **F2** | **Audience, no outcome** | People watched; nothing happened | Lead Generation + Contact Request — a live session must be able to produce something | Partly — both at **P1** |
| **F3** | **Outcome, no evidence** | Something happened; they cannot see or prove it | Seller statistics; lead export before purge | Partly — stats at **P1** |
| **F4** | **Unused hours wasted** | Bought 40 hours, used 12, lost 28 | Rollover; honest expiry warnings | **No** — rollover is Phase 2 |
| **F5** | **Friction to return** | Would buy again, but it is a chore | Warm repurchase in the session-end surface; Scheduled Live as commitment; auto-renew later | Weakly — purchase is web-only (CR-02) |

### The distinction that governs the whole programme

**F1 sellers should churn.** A seller who got no audience did not receive the product, and retaining them with
incentives buys a worse business: they will not return a second time either, and the discount is permanent. **Only
F2–F5 are retention work.** F1 is liquidity work wearing retention's clothes, and the two must be reported
separately or the programme will optimise the wrong thing.

Practical consequence: segment every lapsed seller by whether their sessions cleared the activation threshold. Win-back
only the ones that did. [My Recommendation]

---

## 4. The repurchase loop

### 4.1 Define activation, then instrument it

[My Recommendation] A seller is **activated** when a single session reaches both:

- **≥20 unique viewers** — the matrix §5 liquidity target, so activation and liquidity share one definition, and
- **≥1 Contact Request** (Lead Generation) or **≥3 chat interactions** (Exposure Only).

Activation is measurable on day one and correlates with repurchase weeks before `r` can be computed. Validate the
correlation in the pilot, then treat activation rate as the operational target and `r` as the outcome.

### 4.2 The loop, surface by surface

| Moment | Surface | What it must do |
|---|---|---|
| Session end | In-app summary (PRD S8) | Show the outcome — unique viewers, retention curve, Contact Requests — **then** the remaining hours, **then** a suggested next slot. The repurchase decision is made here, in the 60 seconds after going offline, not in an email three days later |
| 80% / 95% of allowance | In-session + push (PRD §7) | Attach evidence: "your last 4 sessions averaged 34 viewers and 2 Contact Requests." A renewal prompt without outcome data is a bill |
| Before leaving | Scheduled Live (B5) | **Book the next session now.** A commitment device is worth more than a reminder, and the capability already exists |
| Package exhausted | Web account | Repurchase in ≤2 steps with the prior tier pre-selected; no re-entry of stored payment details |
| Expiry approaching | Email, 3 days + at expiry | Honest: name the hours about to be lost, and offer rollover if adopted (§7) |
| Lapse day 7 / 21 / 45 | Email | **Outcomes and an open slot — never a discount.** See §5 |
| Upgrade moment | In-session, on second overage event | A seller repeatedly paying overage is telling you their tier is wrong. Offer the tier, not more overage |

### 4.3 Why the upgrade path is retention, not just revenue

A seller who moves Starter → Growth has revealed that the product works for them. Upgrade rate is therefore both an
NRR lever (§2.1) and the cleanest available proxy for genuine value delivery. It is also the migration the pricing
document's overage rates were tuned to encourage — this is that design paying off, and it should be measured as a
retention metric rather than filed under revenue.

---

## 5. The retention playbook this baseline forbids

Most SaaS retention practice is unavailable here. Naming it prevents a well-meaning growth hire from reintroducing it
six months in.

| Standard tactic | Verdict | Principle |
|---|---|---|
| Personalised save offers, discretionary win-back discounts | **Forbidden** | 5, 13 — every price must be on the published global rate card (pricing §8) |
| Loyalty reach bonus ("6 months with us, here's more visibility") | **Forbidden** | 6 — that is buying ranking with tenure |
| Free hours as a save offer | **Forbidden** | 2 — deletes the seriousness filter (pricing §14.3) |
| Streaks, badges, gamified tenure rewards | **Avoid** | 3 in spirit — the fame economy was removed deliberately; do not rebuild it for sellers |
| Tenure badge or seniority mark | **Forbidden** | 12 — no status marks beyond legal status |
| Longer lead-data retention as a loyalty perk | **Forbidden** | 7 — retention ceilings are not a currency |
| AI coaching as a retention perk on higher tiers | **Forbidden** | 4 — AI is free for all, never a paid advantage |
| Exit-intent discount at cancellation | **N/A and forbidden** | Prepaid has no cancellation moment; and see row 1 |

**What is left is the demanding version:** retention must be earned through audience, outcomes, evidence and
convenience. No incentive layer is available to paper over a product that does not deliver. That is a coherent
position and it follows from the baseline — but it means **the retention programme is mostly a product programme**,
and it cannot be staffed as a lifecycle-marketing function.

**Permitted, and the only levers on price:** a globally uniform annual prepay discount, published volume tiers, and
globally uniform time-boxed promotions (pricing §8). None is personalised, so none can be used as a save offer.

---

## 6. Instrumentation

Aggregate-only, consistent with Principle 7. No per-viewer rows anywhere in this stack.

| # | Measure | Granularity | Why |
|---|---|---|---|
| 1 | Activation rate | Per cohort, per category, per region | Leading indicator (§4.1) |
| 2 | `r` monthly, and the cohort curve | Monthly cohorts | The model's parameter |
| 3 | **`r` split by activated / non-activated** | Monthly cohorts | Separates F1 from F2–F5 (§3). **The single most important cut in this table** |
| 4 | Time-to-repurchase distribution | Days | Reveals whether prepaid behaviour is monthly or episodic |
| 5 | NRR | Monthly | The honest headline |
| 6 | Upgrade rate, downgrade rate | Monthly | Value delivery proxy (§4.3) |
| 7 | Overage incidence and magnitude | Per session, per tier | Tier fit, and an accretive revenue line |
| 8 | Unused-hours ratio at expiry | Per tier | Sizes F4 and the value of rollover |
| 9 | Sessions per package | Per tier | Distinguishes a seller using the product from one who bought and stalled |
| 10 | Lapse → reactivation within 90 days | Cohort | Prevents understating lifetime |
| 11 | Absolute monthly contribution | Total | **The guard against retention theatre** — see §9 |

---

## 7. Scope amendment request

This is the actionable core, and it is a real cost. The financial model shows the MVP as scoped cannot reach
break-even at a plausible `r`. Four capabilities are the difference, and three of them are already built but
scheduled one tier too low.

| # | Capability | Current | Requested | Fixes | Argument |
|---|---|---|---|---|---|
| 1 | **E2 Contact Request** | MVP **P1** | MVP **P0** | F2 | Without it a live session cannot produce a recorded outcome, and Exposure Only gives the seller nothing to weigh at repurchase |
| 2 | **F2 Lead Generation mode** | MVP **P1** | MVP **P0** | F2 | Depends on E2; together they are the outcome layer |
| 3 | **H1 Seller statistics** | MVP **P1** | MVP **P0** | F3 | The only evidence a seller has that the paid product worked. Already argued as "load-bearing for revenue retention" in the matrix — this makes the scheduling match the argument |
| 4 | **Hour rollover (25%, one period)** | **Phase 2** | **MVP** | F4 | The pricing document already named no-rollover as a churn risk. In light of the financial model it is a direct attack on the binding constraint |
| 5 | **B5 Scheduled Live** | MVP P1 | MVP **P0** | F5 | Repurposed from a cold-start mechanism to a commitment device; no new build, only a priority change |

### 7.1 The honest cost, and a funding proposal

**This widens the MVP**, which contradicts the discipline the scope matrix was built on, and I am not going to
pretend otherwise. Items 1, 2, 3 and 5 are priority changes on work already inside MVP, so the incremental build is
item 4 (rollover) plus the acceptance criteria to make the others launch-blocking. But P1→P0 means "cannot launch
without", and that is a real commitment.

**Proposed funding** [My Recommendation]: demote the **Trial Pass** (pricing §4.1) from MVP to Phase 2. It is an
*acquisition* instrument, and acquisition is not the binding constraint. Sellers can start at Starter; the Trial Pass
returns once the repurchase loop is proven and the funnel's top is worth widening.

That is the trade in one line: **stop optimising the first purchase until the second one works.**

### 7.2 What I am not asking for

No new principle, no new commerce mode, no auto-renew at MVP, and no incentive layer. Every item above is either a
re-prioritisation or a small, already-designed mechanic.

---

## 8. 90-day pilot plan

| Phase | Weeks | Objective | Decision gate |
|---|---|---|---|
| **Baseline** | 1–4 | Instrument §6; establish activation rate and the F1/F2–F5 split. Do **no** retention intervention yet | Activation rate known, and the F1 share of lapses known |
| **Diagnose** | 5–8 | First cohort reaches exhaustion; measure `r` split by activation. Interview ~15 lapsed **activated** sellers | If most lapses are F1, **stop this programme and work liquidity** — that is a legitimate and valuable outcome |
| **Intervene** | 9–12 | Ship the §4.2 loop surfaces; measure the change against the baseline cohort | `r` among activated sellers trending ≥0.70 |
| **Gate** | 13 | Decide Phase 2 entry on the financial model's revised criteria | `r` ≥0.70 and improving, CDN commitment secured (financial §9.3) |

**The Diagnose gate matters more than the Intervene phase.** If lapses are dominated by F1, every retention surface
in §4.2 is wasted effort, and the honest recommendation will be to narrow the beachhead further rather than to build
retention machinery. Design the pilot so that answer is reachable.

---

## 9. Risks

| # | Risk | Guard |
|---|---|---|
| R1 | **Retention theatre** — `r` reported while F1 is the real problem | Metric 3: always split by activation. Never report `r` unsplit |
| R2 | **`r` rises while the business shrinks** — suppressing acquisition of marginal sellers raises `r` mechanically | Metric 11: absolute monthly contribution is the headline, `r` is diagnostic |
| R3 | **Small-cohort illusion** | Do not act on a cohort under ~100 sellers; report confidence, not point estimates |
| R4 | **Incentive creep** | §5 is a standing list. Any proposal on it requires a Change Request, not a growth experiment |
| R5 | **Rollover abused as indefinite banking** | Cap at 25%, expiring one period later; never compounding |
| R6 | **Activation threshold set to flatter the numbers** | The threshold is tied to the matrix §5 liquidity target, not chosen for optics. Changing it requires changing that target |

---

## 10. Amendments and open items

### 10.1 Amendments requested

| Document | Change |
|---|---|
| Matrix §3.2 | Promote E2, F2, H1, B5 from P1 to P0 (§7) |
| Matrix §4 | Move hour rollover from Phase 2 to MVP |
| Pricing §4.1 | Demote Trial Pass from MVP to Phase 2 (§7.1) |
| Pricing §6 | Adopt 25% rollover, one period, non-compounding, at MVP |
| Matrix §5 / §15 | Replace "month-2 renewal ≥40%" with `r` ≥0.85 and **NRR ≥100%**; add the activated/non-activated split as a reporting requirement |
| Financial §1 | `r` remains the critical unknown; add NRR as a tracked output |

### 10.2 Open items

| # | Item | Owner |
|---|---|---|
| 1 | Accept or reject the §7 scope amendment, and the Trial Pass trade | Owner |
| 2 | Activation threshold — 20 viewers and 1 Contact Request, or different | Owner + data, after week 4 |
| 3 | Rollover percentage and expiry, and the prepaid-expiry legal question (pricing §14.5 A4) | Owner + counsel |
| 4 | Auto-renew consent design for Phase 2 — opt-in, no pre-ticked default | Product |
| 5 | Who owns `r` — this is a named-person question, not a process one | Owner |
| 6 | Whether win-back email is even permitted under the beachhead's marketing-consent rules | Counsel |

### 10.3 Assumptions

| # | Assumption | Validate with |
|---|---|---|
| A1 | Activation as defined predicts repurchase | Pilot weeks 5–8 |
| A2 | F2–F5 are a majority of lapses (i.e. this programme is worth running) | Pilot Diagnose gate |
| A3 | Outcome evidence at the 95% prompt lifts repurchase | Pilot Intervene phase |
| A4 | Prepaid sellers behave monthly rather than episodically | Metric 4 |
| A5 | Rollover materially reduces F4 lapses | Pilot, post-adoption |
