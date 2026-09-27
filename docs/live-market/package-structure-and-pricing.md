# LIVE MARKET — Package Structure & Pricing Tiers

| | |
|---|---|
| **Document type** | Commercial design recommendation |
| **Baseline** | LIVE MARKET approved baseline, 27 September 2026 |
| **Date** | 2026-09-27 |
| **Prepared by** | Senior Product Consultant & Solution Architect |
| **Status** | Recommendation — price points pending PoC validation of `F_h` and `v_h` |
| **Closes** | Tier variables · entitlement model · tier ladder · price derivation method · overage · unified-pricing mechanics · discount governance |
| **Does not close** | Final price points (await real vendor quotes) · Boost pricing (Phase 2) · enterprise rate-card numbers |
| **Depends on** | [Streaming architecture](./streaming-architecture-webrtc-vs-llhls.md) §11 — delivery-cost shape |
| **Amends** | [MVP Scope Decision Matrix](./mvp-scope-decision-matrix.md) §5 mechanism 5 — see §14 |

> **Tag legend** — **[Approved]** baseline · **[Open]** baseline-declared open question · **[Deferred]** outside the
> baseline's design surface · **[My Recommendation]** consultant judgement, rejectable without touching the baseline.
>
> **Standing caveat.** Every price, rate, tax and FX statement here is a planning assumption requiring specialised
> per-country validation (tax treatment, consumer-law treatment of prepaid expiry, payment licensing). Nothing here
> is legal or tax advice. All unit costs inherit the validation requirement from the streaming document §4.

---

## 1. Start from what a tier may not be

Most pricing damage in a principled marketplace happens through the tier sheet, not through the price. So the
design begins with the prohibitions, each traced to a principle.

| Candidate differentiator | Verdict | Principle |
|---|---|---|
| Organic ranking advantage, priority placement, "featured" slots | **Forbidden** | 6 — ranking signals are fixed and sales-blind; a tier that buys reach is a paid ranking signal |
| Discovery Allocation share | **Forbidden** | 6 — the new-broadcast floor is a fairness mechanism, not inventory |
| AI features, AI limits, AI quality | **Forbidden** | 4 — AI is free for all users and never a paid advantage |
| Badges, status marks, trust signals | **Forbidden** | 12 — accounts display legal status only; there is no "Verified" |
| Commerce mode access (Exposure / Lead Gen / Invoice / Deposit) | **Forbidden** [My Recommendation] | 8 — gating an optional mode behind price converts optionality into a paywall |
| Country-based pricing, PPP adjustment, per-market rate cards | **Forbidden** | 5, 13 |
| **Video quality / max resolution** | **Forbidden** [My Recommendation] | 6 — see below |
| Likes, gifts, tips, any viewer-to-seller transfer | **Not a thing** | 3 |
| Analytics depth | **Not recommended** as a differentiator | Keeps the aggregated-only surface (7) uniform and simple; the tiny revenue is not worth the complexity |

**Why resolution cannot be a tier variable, even though it is the obvious cost lever.** Retention / Watch Time is a
ranking signal (Principle 6). Better video produces better retention. So selling HD to higher tiers sells *indirect
organic ranking* — a Principle 6 breach through the back door, and one that would be invisible in a tier sheet and
very hard to reverse later. **The ABR ladder is identical for every tier** (360p / 480p / 720p, default 480p). Cost
is controlled by volume and by the concurrency mechanism in §3, never by picture quality.

**The same test, applied to the concurrency ceiling.** A hard ceiling that turns viewers away would suppress Unique
Viewers and Retention on cheap tiers — the same back-door breach. Therefore the ceiling must be **soft**: nobody is
ever turned away; the audience is metered and billed (§5). This is the single most important structural decision in
this document.

---

## 2. What is left — the legitimate variables

All of these are capacity and scope. None touches fairness, reach, or quality.

| # | Variable | Cost-aligned? | MVP-enforceable? (matrix C3) |
|---|---|---|---|
| 1 | Broadcast hours per period | Yes — `F_h` per stream-hour | Yes |
| 2 | **Delivered viewer-hours per period** | Yes — `v_h`, the dominant cost | Yes |
| 3 | Broadcaster seats | Indirectly | **No** — Phase 2 (A5) |
| 4 | Concurrent streams | Yes | **No** — MVP is fixed at 1 (C3) |
| 5 | Geo scope — number of target markets | Weakly (Policy Engine + PoP spread) | Yes |
| 6 | Session count / minimum session length | Yes — closes the `F_h` leak | Yes |
| 7 | Support responsiveness | No — ops cost | Yes |

---

## 3. The entitlement model: two dimensions, not one

From the streaming document, cost per broadcast is:

```
DeliveryCost = (F_h × BroadcastHours) + (v_h × BroadcastHours × AvgConcurrency)
             = (F_h × H)              + (v_h × ViewerHours)
```

`F_h` ≈ $0.20 / stream-hour · `v_h` ≈ $0.015 / viewer-hour (480p default, CDN at $0.03/GB). Both assumptions.

A one-dimensional package priced in **broadcast hours alone is unpriceable**: the same 10 hours cost $2 with an
audience of zero and $152 with an audience of 1,000. The audience is the cost, and it is the variable the seller
controls least and the platform predicts worst.

**Therefore every package carries two allowances** [My Recommendation]:

| Allowance | Meaning | Rationale |
|---|---|---|
| **Broadcast hours** | Time the seller may be live (billed on ingest-present time only) | Covers `F_h`; it is also the seller's mental model of what they bought |
| **Viewer-hours** | Delivered audience-hours across all sessions | Covers `v_h`, the dominant cost; makes success cost-visible instead of margin-destroying |

And **audience beyond the allowance is never refused — it is billed** at a globally unified overage rate (§5). A
seller whose broadcast succeeds gets to keep the whole audience; the platform gets paid for delivering it. Both
incentives point the same way, and Principle 6 stays clean.

---

## 4. The tier ladder

Designed in full, but **published only as far as MVP entitlements can be enforced.** At MVP, seats = 1 and
concurrent streams = 1 (matrix C3), so the seat-bearing tiers cannot be sold yet — selling an entitlement the
platform cannot enforce is a refund queue waiting to happen.

### 4.1 MVP catalogue — sellable at launch

| | **Trial Pass** | **Starter** | **Growth** |
|---|---|---|---|
| Price (global sticker, net of tax) | **$5** | **$29** | **$99** |
| Validity | One session | 30 days | 30 days |
| Broadcast hours | 1 | 10 | 40 |
| Included viewer-hours | 100 | 500 | 1,600 |
| Sessions | 1 (one per account, ever) | Unlimited | Unlimited |
| Minimum billed session | 10 min | 10 min | 10 min |
| Broadcaster seats | 1 | 1 | 1 |
| Concurrent streams | 1 | 1 | 1 |
| Target markets (geo scope) | 1 | Up to 5 | Up to 20 |
| ABR ladder | Identical | Identical | Identical |
| Commerce modes | All available | All available | All available |
| AI | Free | Free | Free |
| Discovery Allocation | Identical | Identical | Identical |
| Overage — viewer-hours | Not available | $0.05 / viewer-hour | $0.05 / viewer-hour |
| Overage — broadcast hours | Not available | $1.00 / hour | $1.00 / hour |
| Support | Self-serve | Self-serve | 24h response target |

### 4.2 Phase 2 catalogue — unlocked by A5/A6

| | **Business** | **Enterprise** |
|---|---|---|
| Price | **$399** | Published rate card (§11), not free-form negotiation |
| Broadcast hours | 150 | Custom |
| Included viewer-hours | 6,800 | Custom |
| Broadcaster seats | 5 | 25+ |
| Concurrent streams | 3 | 10+ |
| Target markets | Up to 50 | Global |
| Everything in §1 | Identical to every other tier | Identical to every other tier |

**Deliberately absent: a free tier.** Principle 2 makes paid broadcasting a *seriousness filter*, and a free tier
deletes the filter. The Trial Pass keeps the filter (a verified payment instrument and an identity check) while
removing the price barrier for a seller who has never seen the product — the filter is friction and identity, not the
amount.

---

## 5. How the prices were derived

Not chosen and then justified. Derived from the matrix §6.3 floor:

```
PriceFloor(tier) ≥ 3 × DeliveryCost(tier)
```

| Tier | `F_h × H` | `v_h × ViewerHours` | Delivery cost | 3× floor | **Price** | Gross margin |
|---|---|---|---|---|---|---|
| Trial Pass | $0.20 | $1.50 | **$1.70** | $5.10 | **$5** | 66% |
| Starter | $2.00 | $7.50 | **$9.50** | $28.50 | **$29** | 67.2% |
| Growth | $8.00 | $24.00 | **$32.00** | $96.00 | **$99** | 67.7% |
| Business | $30.00 | $102.00 | **$132.00** | $396.00 | **$399** | 66.9% |

The Trial Pass is the one deliberate exception: $5 sits $0.10 under its own floor, rounded down to a clean number. It
is an acquisition instrument sold once per account, and $0.10 per trialling seller is an acceptable, bounded cost.

**Be precise about what the 3× floor buys.** A 3× multiple is a **66.7% gross margin before payment costs**. With
PSP fees around 3% of revenue, net contribution margin lands near **64%**. To actually hold 70% after PSP, the
multiple must be ~**3.4×**.

**These prices therefore sit deliberately at the floor, not at the target.** That is a launch choice: buy supply
first, and let margin expand without a price change as the CDN moves from on-demand to committed rates. The lever is
explicit — `v_h` falling from $0.03/GB to $0.02/GB (i.e. $0.015 to $0.010 per viewer-hour) lifts Growth's gross margin
from 67.7% to about 75.8% with the sticker price untouched. [My Recommendation] Revisit the multiple, not the tiers, once the PoC returns real numbers.

**Overage rates**

| Overage | Cost | Price | Multiple | Why |
|---|---|---|---|---|
| Viewer-hour | $0.015 | **$0.05** | 3.3× | Holds ~70% on the marginal viewer; success must not dilute margin |
| Broadcast hour | $0.20 | **$1.00** | 5.0× | Ad-hoc hours are lumpy and unforecastable; the cushion prices that variance, and the tier upgrade is always cheaper — which is the intended nudge |

**The `F_h` leak, closed.** `F_h` is charged per *broadcast*, not per viewer, so a seller running forty 90-second
sessions costs far more than one running a single hour. The **10-minute minimum billed session** closes it without
restricting behaviour: go live for two minutes if you like; it bills as ten. [My Recommendation]

---

## 6. Prepaid, not subscription — at MVP

[My Recommendation] Packages are **prepaid and non-recurring** at MVP. Auto-renew is Phase 2.

| Reason | Detail |
|---|---|
| Refunds stay simple | Matrix C7's minimum tier is a published policy plus an admin-executed credit — no proration engine, no mid-cycle math |
| No dunning infrastructure | Failed-payment recovery, retries and involuntary churn handling are an entire subsystem the MVP does not need |
| Works where cards do not | Prepaid suits markets with low card penetration and one-off payment methods — directly relevant to beachhead choice |
| Less regulatory surface | Subscription auto-renewal, cancellation-flow and renewal-notice rules vary sharply by jurisdiction |
| Lower chargeback exposure | One authorised charge per package, not a recurring mandate |
| Matches the baseline's language | The baseline says *packages*, and prepaid is what a package is |

**Validity and rollover.** 30-day validity, **no rollover at MVP** for simplicity — and this is a churn risk worth
naming rather than hiding: a seller who bought 40 hours and used 12 feels the loss at renewal time. Phase 2 should
add limited carryover (recommend 25%, expiring one period later). **Note:** expiry of unused prepaid value is
regulated in some jurisdictions under gift-card and consumer-credit rules — an assumption for counsel (§15).

---

## 7. Globally unified pricing — the mechanics

Principle 5 and Principle 13 are easy to state and easy to lose in implementation detail. The mechanics that keep
them true:

| Mechanic | Rule | Note |
|---|---|---|
| **Unit of account** | One sticker price per tier, denominated in a single reference currency (recommend USD) | [Approved] principle, [My Recommendation] on the currency |
| **Local display** | Converted for display at a **published FX rate re-pegged on a fixed monthly cadence** | Daily re-pegging makes the price appear to change constantly; monthly keeps it a "price", not a quote |
| **FX margin** | A single global FX band, disclosed, identical for every country | A per-country FX margin is country-based pricing wearing a different hat |
| **Tax** | Sticker price is **net**; VAT/GST/sales tax is shown as a separate statutory line | The *price* is identical worldwide; the *tax* is the state's, not ours. **Clarification requested — §14.1** |
| **Payment-method cost** | **Absorbed, never surcharged** | Card and local-method costs vary 1–4% by country; surcharging would re-create country pricing at the checkout. The variance is a margin cost, and it is why §5's multiple matters |
| **Settlement** | May differ by corridor | [Approved] — Principle 13 permits differences in top-up, FX and settlement |
| **Rounding** | Round the *converted display* only, never the base price | Rounding the base by country is country pricing |

---

## 8. Discounts and promotions — where Principle 5 actually dies

It does not die in the price list. It dies in the sales channel, one exception at a time.

| Permitted | Why it is compatible |
|---|---|
| Annual prepay discount — **identical % worldwide** (recommend 2 months free on 12) | Same service, same terms, available to everyone |
| Volume/commitment discounts on a **published** rate card, same thresholds worldwide | Compatible; the rate card is the price list |
| Time-boxed global promotions on identical terms and an identical window | Matrix §11.C.2 clarification |

| Forbidden | Why |
|---|---|
| Any country, region, or currency-specific price or discount | Principles 5, 13 |
| PPP / "emerging market" adjustment | Same, however well-intentioned |
| Free-form negotiated enterprise pricing | Erodes Principle 5 through the channel. Enterprise must be a **published rate card** — clarification §14.2 |
| Reseller or distributor margins that change the effective price by market | Country pricing with extra steps |
| Discounting the entry tier to **$0** | Deletes the Principle 2 seriousness filter — see §14.3 |

**Governance** [My Recommendation] — Principle 5 needs an owner and an audit, not just a sentence:

1. One published global rate card; every sellable price appears on it.
2. No discount exists that is not on the rate card. No exceptions field in the billing system.
3. Any new price or promotion requires a named approver and a written Principle 5 check.
4. Quarterly audit: effective price realised per country. Divergence beyond FX and tax is a defect, with a ticket.

---

## 9. Refunds — implementing matrix C7

| Situation | Treatment | Basis |
|---|---|---|
| Package unused (zero broadcast hours consumed), within 14 days | **Full refund** | Aligns with withdrawal rights for digital services in several markets; assumption for counsel |
| Partially used, within 14 days | Pro-rata **platform credit** for unconsumed hours; cash refund at platform discretion | [My Recommendation] |
| Consumed | No refund | |
| Platform fault (ingest failure, outage, wrongful takedown later reversed) | **Credit of affected hours plus the affected viewer-hours**, automatic where detectable | [My Recommendation] — and it is why ingest-time billing (§3) matters: a session that never delivered should never have billed |
| Overage charges | Refundable only on platform fault | |
| Trial Pass | Non-refundable, one per account ever | Abuse surface |

MVP implementation stays at C7's minimum tier: published policy + admin-executed credit + audit record (matrix I2).

---

## 10. What entitlement enforcement must actually check

Handing this to engineering as the C3 acceptance criteria.

| # | Check | Timing | Failure behaviour |
|---|---|---|---|
| 1 | Active package with remaining broadcast hours | Go-Live pre-flight (B1) | Block Go-Live, offer purchase |
| 2 | Geo scope covers every selected target market | Go-Live pre-flight | **Remove the out-of-scope markets** and state why — never reject the campaign (mirrors the Policy Engine convention in D7) |
| 3 | Concurrent streams within tier limit | Go-Live | Block the additional stream, name the limit |
| 4 | Seat is valid and not already live (Phase 2) | Go-Live | Block, name the seat |
| 5 | Broadcast-hour metering on **ingest-present time**, 10-min minimum | Continuous | Warn at 80% / 95%; on exhaustion, end the session gracefully with notice |
| 6 | Viewer-hour metering, continuous | Continuous | **Never throttle or turn away viewers.** Cross into overage, notify the seller, record the charge |
| 7 | Overage cap per period | Continuous | A seller-set spend ceiling, default on; on reaching it, end the session rather than accrue silently — nobody should discover an unbounded bill |
| 8 | Validity window | Daily | Expire remaining hours, notify in advance |

Row 6 and row 7 together are the whole philosophy: **the audience is never punished for a package limit; the seller
is never surprised by a bill.**

**Entitlement fraud is not "Anti-Abuse".** Seat sharing and package circumvention are contract enforcement, and
enforcing them at MVP is legitimate. Principle 14's Anti-Abuse constraint concerns **bots and synthetic traffic**,
where enforcement is [Deferred] and readiness is architectural (matrix G5). Conflating the two would either
under-enforce contracts or over-enforce against real humans. One consequence worth stating: **viewer-hour metering
must not penalise a seller for synthetic traffic they did not buy** — suspected synthetic viewer-hours are excluded
from billing pending review, which is also a strong reason for the G5 instrumentation to exist at MVP.

---

## 11. Boost and LM stay outside the tier sheet

| Item | Treatment | Tag |
|---|---|---|
| Boost (paid amplification) | **Separate prepaid campaign budget, never a tier inclusion and never bundled** | [Open] → Phase 2 (matrix C4) |
| Why not bundled | Bundling amplification into a subscription tier makes reach a subscription benefit — a Principle 6 breach identical to the ones in §1 | Principle 6 |
| Boost labelling | Amplified impressions must be distinguishable from organic placement | [My Recommendation] |
| LM viewer rewards | Drawn from the advertiser's campaign budget, never from platform subsidy, never from package revenue | Principle 13 [Approved] |
| LM as a tier perk | **Forbidden** — it would make rewards platform-subsidised | Principle 13 |
| Wallet, custody, top-up, transferability | Not designed here | [Deferred] |

---

## 12. Does this business actually work?

Contribution per seller per period, after delivery cost and ~3% PSP fees:

| Tier | Price | Delivery | PSP | **Contribution** |
|---|---|---|---|---|
| Starter | $29 | $9.50 | $0.87 | **$18.63** |
| Growth | $99 | $32.00 | $2.97 | **$64.03** |
| Business | $399 | $132.00 | $11.97 | **$255.03** |

**Fixed monthly cost to cover at MVP** (order of magnitude, [My Recommendation] for planning only):

| Line | Estimate |
|---|---|
| 24/7 moderation rota (matrix G4) — the dominant fixed cost | $15,000 – 30,000 |
| Control plane, database, Redis, chat service | $250 – 700 |
| Engineering, support, admin ops | Organisation-dependent |
| **Media cost** | Variable — already inside delivery cost above |

**Break-even on a $25,000/month fixed base:**

| Seller mix | Sellers needed |
|---|---|
| All Growth | ~390 |
| All Starter | ~1,342 |
| Blended 60% Starter / 35% Growth / 5% Business (Phase 2) | ~**540** |

Two observations that should shape the go-to-market:

1. **Moderation, not media, is the fixed-cost wall at MVP.** The 24/7 rota is roughly the cost of 400 Growth sellers and it is due before the first seller signs. Media cost, by contrast, arrives only with usage. This argues for the narrow beachhead (fewer languages and fewer hours to cover) more strongly than any infrastructure argument does.
2. **Starter is a poor place to live.** At ~$19 contribution it takes 1,342 sellers to break even. Starter is an on-ramp, and the commercial objective is migration to Growth — which is exactly what the overage rates in §5 are tuned to encourage. If most sellers stay on Starter, that is not a pricing success; it is a signal that broadcasting is not yet producing outcomes worth $99.

---

## 13. What this hands to the seller-journey PRD

1. Purchase happens **on web** (matrix C2 / CR-02) — the app surfaces entitlements and Go-Live only.
2. Go-Live pre-flight must show **remaining hours and remaining viewer-hours** before the seller commits, not after.
3. In-session: a non-intrusive indicator of viewer-hours remaining, and a clear overage state.
4. A seller-set **overage spend ceiling**, default on (§10 row 7).
5. Warnings at 80% and 95% of each allowance, in-session and by notification.
6. Session end for exhausted hours is **graceful and pre-announced**, and must read as distinct from the Principle 1 hard stop — one is "your package ran out", the other is "you left".

---

## 14. Amendments and clarifications

### 14.1 Clarification — tax is not a price difference

**No principle change sought.** Confirm that a globally identical **net** sticker price, with VAT/GST/sales tax shown
as a separate statutory line, satisfies Principles 5 and 13 — even though the final amount charged differs by
country (0% to ~27%). The alternative — a globally identical *tax-inclusive* price — would mean the platform absorbs
a variable 0–27% tax, which makes net revenue per seller country-dependent and is unviable.

### 14.2 Clarification — enterprise pricing must be a published rate card

Confirm that Enterprise pricing is a **published, globally uniform volume rate card** rather than free-form
negotiation. Principle 5 does not survive a sales channel with discretionary discounting, and an enterprise
exception is how unified pricing quietly becomes nominal.

### 14.3 Amendment to matrix §5, mechanism 5 — "Founding Broadcaster" must not be free

The scope matrix described a Founding Broadcaster programme offering "free or discounted packages". **The free
variant is wrong and I am withdrawing it.** Principle 2 makes paid broadcasting a seriousness filter against
non-commercial content; a free package removes the filter at exactly the moment the market is least able to moderate
the consequences, and it seeds the market with supply that had no commercial intent. **Recommended replacement:** a
globally uniform, time-boxed discount with a hard floor (recommend up to 70% off, never below the Trial Pass price),
plus identity verification. The discount buys supply; the floor keeps the filter.

### 14.4 Still open

| # | Item | Blocked on |
|---|---|---|
| 1 | Final price points | PoC-measured `F_h` and `v_h` (streaming doc §10) |
| 2 | Reference currency | Beachhead decision + PSP corridor availability |
| 3 | Boost pricing and Qualified View | Phase 2, separate deliverable |
| 4 | Enterprise rate-card thresholds | Phase 2, after A5/A6 |
| 5 | Rollover policy | Phase 2, plus the prepaid-expiry legal question below |
| 6 | Whether Starter→Growth migration actually happens | Measurable only in the pilot; §12 observation 2 |

### 14.5 Assumptions requiring validation

| # | Assumption | Validate with |
|---|---|---|
| A1 | `F_h` = $0.20/stream-hour, `v_h` = $0.015/viewer-hour | Vendor quotes; streaming doc §10 PoC |
| A2 | PSP cost ≈ 3% blended | PSP quotes per corridor |
| A3 | Net-of-tax global sticker pricing is compliant in launch markets | Tax counsel per market (matrix R9) |
| A4 | Unused prepaid expiry after 30 days is enforceable | Consumer-law counsel per market (matrix R4) |
| A5 | 14-day full refund on unused packages satisfies withdrawal rights | Counsel per market |
| A6 | $29 is high enough to act as a seriousness filter and low enough for an individual seller | Pilot conversion and content-quality data |
| A7 | Avg concurrency of 20–45 viewers per broadcast is realistic | Matrix §5 liquidity targets, measured in the pilot |

---

## 15. Decision summary

| Question | Answer |
|---|---|
| What differentiates tiers? | **Capacity and scope only** — hours, viewer-hours, seats, concurrent streams, geo scope, support |
| What must never differentiate tiers? | Ranking, reach, Discovery Allocation, AI, badges, commerce modes, **video quality** |
| How is audience handled at the limit? | **Metered and billed, never refused** — soft ceiling with overage and a seller-set spend cap |
| How many tiers at MVP? | **Three sellable** (Trial Pass, Starter, Growth); Business and Enterprise wait for A5/A6 |
| Prices | **$5 / $29 / $99**, with $399 in Phase 2 — derived from the 3× floor, sitting at the floor by choice |
| Overage | **$0.05 per viewer-hour · $1.00 per broadcast hour**, globally unified |
| Billing model | **Prepaid, 30-day, non-recurring**; auto-renew Phase 2 |
| Free tier? | **No** — Principle 2. A $5 Trial Pass instead |
| How does unified pricing survive? | Net-of-tax USD sticker, monthly FX peg, absorbed payment costs, published rate card, and an audit with an owner |
