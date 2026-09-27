# LIVE MARKET — Moderation Operating Model

| | |
|---|---|
| **Document type** | Operating model + cost model |
| **Baseline** | LIVE MARKET approved baseline, 27 September 2026 |
| **Date** | 2026-09-27 |
| **Prepared by** | Senior Product Consultant & Solution Architect |
| **Status** | Recommendation — the rota sizing and the CR-01 decision are both on the critical path |
| **Closes** | Risk taxonomy · four-layer stack · automated-detection economics · rota sizing · triage SLA · tooling · appeals · QA · wellbeing |
| **Does not close** | Per-country rulebook content (counsel, per launch market) · vendor selection for classification · final headcount (depends on beachhead) |
| **Amends** | [Packages & pricing](./package-structure-and-pricing.md) §5 and §12 — **materially. See §13** |
| **Depends on** | [Scope matrix](./mvp-scope-decision-matrix.md) G1–G5, CR-01 · [Seller PRD](./seller-journey-prd.md) S8 ending 5 |

> **Tag legend** — **[Approved]** baseline · **[Open]** baseline-declared open question · **[Deferred]** outside the
> baseline's design surface · **[My Recommendation]** consultant judgement, rejectable without touching the baseline.
>
> **Standing caveat.** Illegal-content duties, online-safety regimes, age-assurance requirements, employment law for
> moderator wellbeing, and per-country category rules are all assumptions requiring specialised per-country
> validation. Nothing here is legal advice.

---

## 1. Why this is the hardest operating problem in the baseline

Four baseline choices each remove a tool that conventional platforms rely on.

| Baseline choice | What it removes | Consequence |
|---|---|---|
| **Live-only** [Approved] | Pre-publication review. You cannot approve a broadcast before it exists | Harm occurs *while* you decide. Every control is either preventive or real-time; nothing is pre-emptive |
| **Global 24/7** [Approved] | Business hours | A market open at 03:00 needs a moderator awake at 03:00. There is no "we'll look at it tomorrow" |
| **No video storage** [Approved, Principle 7] | The post-hoc artefact | A report arriving after a session ends has nothing to review — this is the whole of **CR-01** |
| **No replay** [Approved] | Retroactive takedown | Content cannot be removed after the fact, because it no longer exists. Conversely: the harm window is bounded by the session |

And two that make the job **materially easier** than on a free UGC platform — worth stating, because moderation
planning tends to assume the worst case:

| Baseline choice | What it removes from the threat model |
|---|---|
| **Paid broadcasting** [Approved, Principle 2] | The dominant abuse vector on free platforms: zero-cost, disposable accounts at volume. Here every broadcaster has paid, with a verified payment instrument, and can be barred at the payment level. The paywall is the single strongest moderation control in the product |
| **No likes / gifts / tipping** [Approved, Principle 3] | The entire engagement-farming and begging economy — a large share of live-streaming abuse exists to harvest gifts and attention. Removing the reward removes the behaviour |

**Net:** LIVE MARKET starts with a structurally *lower* abuse rate than free live platforms, and a structurally
*harder* response problem. Plan the volume optimistically and the response capability pessimistically — not the
reverse.

---

## 2. Risk taxonomy

Severity drives response time; response time drives headcount. This table is therefore the input to §6.

| # | Category | Severity | Primary detection | Target time to action |
|---|---|---|---|---|
| R1 | Child sexual abuse material, or a minor as the broadcaster | **Critical** | Automated vision + report | **Immediate kill, < 60 s**, preserve per legal duty, report to authorities per market |
| R2 | Credible threat, violence in progress, self-harm | **Critical** | Automated vision/ASR + report | Immediate kill, < 60 s, escalate |
| R3 | Illegal goods — weapons, drugs, wildlife, stolen goods, human trafficking indicators | **Critical** | Vision + ASR + report + category mismatch | < 2 min |
| R4 | Sexual content, nudity | **High** | Vision | < 2 min |
| R5 | Hate speech, harassment — by seller or in chat | **High** | ASR + chat text filter + report | < 5 min (chat: automated instant) |
| R6 | Regulated category without the required permit (pharma, financial services, alcohol/tobacco where restricted) | **High** | Category declaration vs. Policy Engine + ASR | < 5 min |
| R7 | Counterfeit goods, IP infringement, unlicensed background music | **Medium** | Vision/audio fingerprint + rights-holder report | < 30 min, or post-session |
| R8 | Fraud / misrepresentation — non-existent inventory, bait and switch | **Medium** | Viewer reports, pattern across sessions | Post-session investigation |
| R9 | **Non-commercial broadcasting** — the Principle 2 filter failing | **Low** | Human sampling | Warning first; see §3 |
| R10 | Sensitive but lawful content | **Not a violation** | Seller declaration + vision | **Age gate + content notice, never hiding** (Principle 10) |
| R11 | Bot / synthetic viewership | **Out of scope for moderation** | G5 instrumentation only | **Enforcement [Deferred]** (Principle 14) — see §11 |

**R9 needs a definition, or it becomes a licence for arbitrary enforcement.** [My Recommendation] A broadcast is
commercial when the seller is presenting goods or services they are offering. Enforcement is **warning-first and
never automated**, because the false-positive rate is high: a seller spends the first ten minutes on context, on
answering an unrelated question, on waiting for viewers. Three warnings in a rolling 90 days before any suspension.
The paywall already does most of this work; the moderation layer should not re-do it aggressively.

**R11 is deliberately not a moderation category.** Principle 14 makes Anti-Abuse an architectural readiness activated
only against bots and synthetic traffic, and states that natural human LM-collecting behaviour is not abuse. Content
moderation and traffic analysis must therefore live in **separate systems with separate queues**, so that a future
anti-abuse enforcement decision cannot leak into content enforcement, and so no moderator is ever asked to judge
whether a human's viewing pattern is "too enthusiastic".

---

## 3. The four-layer stack

| Layer | Mechanism | Catches | Misses | Cost shape |
|---|---|---|---|---|
| **L0 — Prevention** | Paywall + payment instrument + identity (matrix A3) · policy acceptance · category declaration · Policy Engine region removal (D7) · pre-flight sensitive-content declaration | Casual and disposable-account abuse; most jurisdictional violations | Deliberate abuse by a paying, identified actor | Near zero marginal — **the cheapest layer by orders of magnitude** |
| **L1 — Automated real-time** | Keyframe sampling + ASR + chat text filter, with confidence tiers | Visual and spoken policy violations at scale, instantly | Context, sarcasm, intent, most fraud, dialect-heavy speech | **Per stream-hour — see §4.** Larger than people expect |
| **L2 — Human real-time** | 24/7 rota watching a prioritised grid and working a triage queue | Context, intent, judgement calls, escalations | Everything happening on the streams nobody is watching | **Per shift-hour — the fixed wall, §6** |
| **L3 — Post-hoc** | Reports after session end, appeals, pattern investigation | Fraud patterns, rights-holder claims, wrongful takedowns | Anything with no surviving evidence | Per case — **and largely non-functional without CR-01** |

**The layers are not interchangeable.** L0 is where the money is: every unit of abuse prevented at L0 costs nothing,
and every unit that reaches L2 costs a human minute at 03:00. The operating strategy is therefore to keep pushing
work down to L0 — stricter identity for repeat offenders, category gating, payment-level bans — rather than adding
moderators.

---

## 4. Automated detection economics — the finding that changes the cost model

Sampling rate is usually treated as a tuning detail. At LIVE MARKET's scale it is a first-order cost driver, and
naive settings cost **more than video delivery does.**

### 4.1 Unit assumptions (validation required)

| Component | Assumption |
|---|---|
| Vision classification, per sampled frame | **$0.001 – $0.003** |
| ASR, per audio-minute | **$0.002 – $0.024** (wide: small self-hosted models at the low end, premium managed at the high end) |
| Chat text filtering | Negligible — rules plus a small model |

### 4.2 Cost per stream-hour at fixed sampling

| Keyframe interval | Frames / stream-hour | Vision cost / stream-hour |
|---|---|---|
| Every 10 s | 360 | **$0.36 – $1.08** |
| Every 30 s | 120 | **$0.12 – $0.36** |
| Every 60 s | 60 | **$0.06 – $0.18** |

| ASR coverage | Cost / stream-hour |
|---|---|
| Continuous, premium managed | **$1.44** |
| Continuous, low-cost model | **$0.12** |
| 25% duty cycle, low-cost | **$0.03** |

**Compare with delivery: `F_h` ≈ $0.20 per stream-hour** (pricing §3). Continuous premium ASR plus 10-second
keyframes costs **up to $2.52 per stream-hour — twelve times the cost of delivering the broadcast.**

### 4.3 Recommended design: adaptive sampling

[My Recommendation] A fixed rate is wrong in both directions — too expensive for a compliant seller on their
fortieth session, too slow for an unknown seller in a high-risk category.

| Tier | Trigger | Keyframe interval | ASR |
|---|---|---|---|
| **Baseline** | Established seller, low-risk category, clean history | 60 s | 25% duty cycle |
| **Elevated** | New seller (first 3 sessions), elevated-risk category, prior warning, any chat report | 10 s | Continuous |
| **Hot** | Classifier near threshold, active report, moderator flag | 2 s | Continuous + human attached |
| **Post-violation** | Any confirmed violation in 90 days | 10 s minimum, indefinitely | Continuous |

Blended estimate at a realistic mix (≈75% baseline / 20% elevated / 5% hot), using low-cost ASR:

**`M_h` ≈ $0.10 – $0.25 per stream-hour** [My Recommendation for planning]

### 4.4 Confidence tiers and permitted automated actions

| Classifier confidence | Automated action | Human involvement |
|---|---|---|
| Very high, critical category (R1, R2) | **Immediate kill** + escalation | Notified immediately, reviews after |
| High | Escalate to Hot sampling, push to front of queue | Human decides within SLA |
| Medium | Elevate sampling, queue normally | Human decides |
| Low | Log only | None |

**Only R1 and R2 may be terminated by a machine alone.** Everything else requires a human decision, because an
automated kill on a paying seller mid-sale is a commercial and reputational event, and the appeal (§9) has to be
answerable.

### 4.5 Language is a beachhead variable

ASR accuracy varies sharply by language and, within Arabic, by dialect — Gulf, Egyptian and Levantine speech is
materially harder than English for most managed models. **A MENA beachhead therefore shifts load from L1 to L2**, i.e.
from compute to headcount, which is the more expensive direction. This belongs in the beachhead decision explicitly:
it is not a reason to avoid MENA, but it is a reason to budget more human hours there than an English-first launch
would need. [My Recommendation]

---

## 5. Triage and SLA

| Priority | Sources | First response | Who may terminate a stream |
|---|---|---|---|
| **P0 — Critical** (R1, R2) | Automated very-high confidence, any report matching pattern | **< 60 s** | Automation, any moderator, on-call lead |
| **P1 — High** (R3–R6) | Automated high, viewer report, category mismatch | **< 2–5 min** per §2 | Any moderator |
| **P2 — Medium** (R7, R8) | Reports, rights-holder claims | < 30 min in-session; otherwise same day | Shift lead |
| **P3 — Low** (R9) | Sampling, patterns | Next business day, warning-first | Policy lead only |

**Escalation.** Every shift has a named lead; every day has a named on-call policy owner reachable within 15 minutes
for P0. Legal escalation (authority reporting, preservation requests) is a documented runbook, not an improvisation.

**Queue discipline.** A live stream in the queue ages differently from a ticket: after the session ends, the
opportunity to act is gone. Queue ordering must therefore weight **remaining session time**, not just severity —
a P1 on a stream that has been live for 3 hours outranks a P1 on a stream that started 30 seconds ago only if the
older stream is still live.

---

## 6. Rota sizing — the fixed-cost wall

### 6.1 Supervision ratios

| Stream risk tier | Streams per moderator |
|---|---|
| Baseline (grid view, automated assistance) | 6 – 8 |
| Elevated | 2 – 3 |
| Hot | 1, with full attention |

### 6.2 MVP sizing at beachhead concurrency

Assuming the matrix §5 liquidity target — ≥5 concurrent broadcasts per category × region during Market Hours, across
3 categories:

| Period | Concurrent streams | Moderators needed | Rationale |
|---|---|---|---|
| Market Hours (~8 h/day) | ~15 peak | **3** | Ratio of 6, plus queue work |
| Off-peak (~16 h/day) | ~3 | **2** | Never fewer than two: a global safety function cannot have a single point of human failure, and P0 escalation needs a second pair of eyes |

Weekly moderator-hours = (8 × 7 × 3) + (16 × 7 × 2) = 168 + 224 = **392 h/week**
÷ ~38 h per FTE = **10.3 FTE**, × 1.25 for leave, training, sickness and attrition = **≈ 13 FTE**
Plus a policy lead and a QA/appeals specialist = **≈ 15 FTE at launch** [My Recommendation]

### 6.3 Cost

| Loaded cost per moderator FTE / month | 15 FTE / month |
|---|---|
| $1,800 | **$27,000** |
| $2,600 | **$39,000** |
| $3,500 | **$52,500** |

**Planning figure: $27,000 – $52,500 per month, before the first seller signs.**

Note on cost variance: moderator cost differs by where the team sits. That is a **cost** difference, not a price
difference, and it does not touch Principles 5 or 13 — those govern what sellers are charged, not where the platform
hires. The only constraint is capability: language coverage and cultural context for the beachhead markets.

---

## 7. Tooling requirements

| # | Requirement |
|---|---|
| T1 | **Grid view** of live streams ordered by risk tier, with the classifier signal visible per tile |
| T2 | **One-click kill** with a mandatory reason code, and an audit record naming the moderator |
| T3 | Per-stream controls: mute seller audio, disable chat, eject viewer, force sensitive-content notice, force age gate |
| T4 | **Evidence buffer access** (CR-01) — time-boxed, reason-logged, individually audited. Access is an event, not a permission |
| T5 | Case record: signals, actions, decision, reviewer, timestamps; retained per the retention schedule |
| T6 | Appeal queue with the original evidence reference and the prior decision |
| T7 | Seller history view: prior warnings, confirmed violations, sampling tier |
| T8 | Escalation button with runbook attached, and paging for the on-call policy owner |
| T9 | Shift handover note, enforced at shift boundaries |

**What the console must NOT allow:**

| # | Prohibition | Reason |
|---|---|---|
| T10 | No bulk export or download of buffered video, ever | Principle 7 and CR-01's whole premise |
| T11 | No browsing of viewer identities or viewing history | Principle 7 |
| T12 | No access to a seller's Contact Request payloads | Lead data is not a moderation input |
| T13 | No moderator-visible ranking or discovery controls | Principle 6 — moderation removes content, it never promotes it |

T13 matters more than it looks: the moment a moderation tool can raise a broadcast's visibility, ranking becomes
discretionary, and Principle 6 is gone through a side door.

---

## 8. If CR-01 is rejected

CR-01 requests a ~120-second rolling evidence buffer, purged at session close except for an open report. If the owner
rejects it, this operating model degrades as follows — stated so the decision is made with the consequences visible:

| Function | With CR-01 | Without CR-01 |
|---|---|---|
| Report arriving after session end | Reviewable | **Unactionable** — and most reports arrive after the fact |
| Appeals | Evidence-based both ways | Moderator's word against seller's |
| Authority requests | Answerable within the buffer window | Nothing to provide |
| Rights-holder claims (R7) | Assessable | Refusable only |
| Repeat-offender cases | Documented pattern | Assertion |
| Automated kill on R1/R2 | Verifiable after the fact | Unverifiable |

**Compensating measures if rejected** [My Recommendation]: raise baseline sampling to 10 s for all streams (roughly
doubling `M_h`), increase L2 headcount by ~30% so more streams are watched live rather than reviewed later, and state
the limitation plainly in the published moderation policy. The risk does not disappear — it converts into cost and
into unresolvable disputes.

---

## 9. Appeals and due process

A platform that terminates a paying seller's broadcast owes them a process. This is also the best defence against
enforcement drift.

| Stage | Rule |
|---|---|
| Notice | Immediate, in-app and by email, naming the category and the action — never a bare "policy violation" |
| Appeal window | 14 days [My Recommendation] |
| Reviewer | Never the moderator who made the decision |
| Target resolution | 5 business days; P0 categories reviewed by the policy lead |
| Evidence | The buffered window (CR-01), the classifier signals, the case record |
| On reversal | Broadcast hours **and** viewer-hours credited (pricing §9), the record expunged from the seller's history, and the sampling tier reset |
| On upholding | Reason given; the strike stands; escalation path to a second review for suspensions |
| Transparency | Aggregate enforcement statistics published periodically [My Recommendation] |

**Warning ladder** [My Recommendation]: for R7–R9, warning → warning → suspension, over a rolling 90 days. For
R1–R6, immediate termination with no ladder, and account-level action where the category warrants it.

---

## 10. Policy structure and quality

**Rulebook shape** — a global baseline plus per-country overlays, which is exactly the Policy Engine's content
(matrix D7):

| Layer | Content | Owner |
|---|---|---|
| Global prohibitions | R1–R5: unlawful everywhere the platform operates | Policy lead + counsel |
| Category × country matrix | R6, R7: permit requirements and category restrictions per market | Counsel per market (matrix R6, R7) |
| Sensitive-but-lawful | R10: age gate and notice thresholds per market | Counsel + policy |
| Commercial-intent rule | R9, per §2 | Policy lead |

**Review cadence:** category × country matrix reviewed before each new market opens and quarterly thereafter. A rule
nobody owns is a rule that goes stale and then gets enforced wrongly.

**Quality assurance:**

| Metric | Target |
|---|---|
| Decision audit sample | ≥5% of all enforcement actions, weekly |
| Inter-rater agreement on the audit sample | ≥85% [My Recommendation] |
| Appeal reversal rate | Tracked per category; a rising rate in one category means the rule is wrong, not that moderators are careless |
| False-positive rate on automated kills (R1/R2) | Tracked individually; every instance reviewed |
| P0 time-to-action | p95 < 60 s — **the single metric that matters most** |

---

## 11. Wellbeing — non-negotiable

Any honest operating model for this work includes it. It is also a retention and liability question, not only an
ethical one.

| # | Requirement |
|---|---|
| W1 | Maximum exposure time on high-severity queues per shift, with mandatory rotation onto low-severity work |
| W2 | Blur-by-default and audio-off-by-default when opening R1/R2 evidence, with deliberate reveal |
| W3 | Access to professional psychological support, paid, from day one — not after an incident |
| W4 | No individual works R1 cases alone; two-person handling on the most severe category |
| W5 | Realistic throughput targets: a queue metric that rewards speed on R1 cases is a harm-producing metric |
| W6 | Recruitment that states the nature of the work explicitly |

---

## 12. Launch gate

Matrix launch gate #4 is "24/7 rota staffed, trained, with a tested escalation path". Concretely:

| # | Gate |
|---|---|
| 1 | ≈15 FTE hired, trained, and rostered with no uncovered hour in the week |
| 2 | Language coverage for every beachhead market, including dialects |
| 3 | Category × country matrix loaded and signed off by counsel for every launch market |
| 4 | P0 escalation drill run end to end, including the authority-reporting runbook |
| 5 | Moderator console delivering T1–T9, and provably refusing T10–T13 |
| 6 | Appeal path live, with a named reviewer who is not a shift moderator |
| 7 | CR-01 decided, and the corresponding configuration implemented |
| 8 | Wellbeing measures W1–W6 in place **before** the first shift, not after |

---

## 13. Amendments to the pricing document

This is the material correction in this deliverable, and it goes the wrong way. Moderation compute was missing from
the serving-cost model.

### 13.1 The floor formula gains a third term

```
Before:  DeliveryCost = (F_h × H) + (v_h × ViewerHours)
After:   ServingCost  = ((F_h + M_h) × H) + (v_h × ViewerHours)

where M_h ≈ $0.10 – $0.25 per stream-hour (§4.3)
```

Recomputed at `F_h` = $0.20, `M_h` = $0.15, `v_h` = $0.015:

| Tier | Serving cost | 3× floor | Current price | Verdict |
|---|---|---|---|---|
| Starter (10 h, 500 vh) | $11.00 | $33.00 | **$29** | **Below floor** |
| Growth (40 h, 1,600 vh) | $38.00 | $114.00 | **$99** | **Below floor** |
| Business (150 h, 6,800 vh) | $154.50 | $463.50 | **$399** | **Below floor** |

Gross margins become 62.1% / 61.6% / 61.3% — down from ~67%.

### 13.2 Break-even moves

| | Before | After |
|---|---|---|
| Fixed monthly base | $25,000 | **$35,000** (§6.3 midpoint) |
| Growth contribution | $64.03 | **$58.03** |
| Blended contribution | $46.34 | **$42.22** |
| **Blended break-even sellers** | ~540 | **~830** |

### 13.3 Three options, and a recommendation

| Option | Effect |
|---|---|
| **A — Raise prices ~20%** ($35 / $119 / $479) | Restores the 3× floor exactly. Costs launch-supply velocity at precisely the moment supply is scarcest |
| **B — Hold prices, accept ~62% gross margin** [My Recommendation] | Keeps the supply-acquisition strategy intact. The two levers that restore margin without a price change are already identified: adaptive sampling driving `M_h` toward $0.10, and CDN commitment driving `v_h` toward $0.010. Together they return the blend to roughly 70% |
| **C — Reduce moderation coverage** | **Rejected.** It trades a margin point for a safety failure, and it puts matrix launch gate #4 and app-store approval at risk |

**Recommendation: B**, with the floor rule restated honestly as "3× serving cost at target unit costs, ~2.6× at
launch unit costs" so nobody later discovers the floor was quietly redefined. Revisit at the PoC, when `F_h`, `M_h`
and `v_h` are all measured rather than assumed.

---

## 14. Open items and assumptions

| # | Item | Owner |
|---|---|---|
| 1 | **CR-01** — decides whether §8's degraded model applies | Owner |
| 2 | Beachhead — sets language coverage, rulebook scope, and §6 headcount | Owner |
| 3 | Pricing response to §13 — option A, B or C | Owner |
| 4 | Classification vendor selection and measured accuracy per language | Architecture + Trust & Safety |
| 5 | Age-assurance strength — whether a self-declared gate suffices per market | Counsel (matrix R3) |
| 6 | Authority-reporting obligations and preservation duties per market | Counsel (matrix R2) |
| 7 | Retention of moderation case records vs. Principle 7 | Counsel |
| 8 | In-house rota vs. outsourced BPO | Owner — outsourcing changes cost and wellbeing governance, not the requirements |

| # | Assumption | Validate with |
|---|---|---|
| A1 | Vision $0.001–0.003/frame; ASR $0.002–0.024/min | Vendor quotes at volume |
| A2 | Supervision ratio of 6–8 baseline streams per moderator | Measured in the pilot; adjust §6 accordingly |
| A3 | Loaded moderator cost $1,800–3,500/month | Recruitment in the chosen location |
| A4 | Abuse rate is structurally lower because of the paywall (§1) | Pilot data — **this is the assumption most worth being wrong about**, since the rota is sized on it |
| A5 | ASR dialect accuracy materially lower for Arabic dialects | Vendor benchmarks on real beachhead audio, not published English figures |
