# LIVE MARKET — Policy Engine: Rulebook Scaffold

| | |
|---|---|
| **Document type** | Structural scaffold + evaluation specification |
| **Baseline** | LIVE MARKET approved baseline, 27 September 2026 |
| **Date** | 2026-09-28 |
| **Prepared by** | Senior Product Consultant & Solution Architect |
| **Status** | Recommendation — **the structure is mine, the content is counsel's.** Not usable until populated per launch market |
| **Closes** | Rule data model · verdict vocabulary · category taxonomy · evaluation algorithm · unknown-cell default · versioning and audit · seller-facing behaviour · per-market delivery checklist |
| **Does not close** | **Any actual legal determination.** Every cell in the matrix is counsel's to fill |
| **Depends on** | [Scope matrix](./mvp-scope-decision-matrix.md) D7, R6, R7, R10 · [Moderation](./moderation-operating-model.md) §2 · [Seller PRD](./seller-journey-prd.md) S6.4 |

> **This document contains no legal advice and no legal conclusions.** Every category × country value shown anywhere
> below is a **structural placeholder**, chosen to demonstrate the data shape, and must not be read as a statement
> about any jurisdiction's law. The engine is a container; counsel supplies the contents, per market, before that
> market opens.

---

## 1. What the Policy Engine is for

Principle 11 [Approved], stated precisely: **ad legality is checked against the advertiser's selected target markets,
and the engine removes non-compliant regions rather than rejecting the entire campaign.**

That single sentence dictates the whole design:

| Implication | Consequence |
|---|---|
| Evaluation is **per (region × category)**, not per campaign | A campaign is a set of regions, each evaluated independently |
| The output is a **set of removals with reasons**, never a rejection | "Rejected" is not a verdict this engine can produce |
| The seller must see **which regions were removed and why** | Silent removal would be indistinguishable from a bug |
| Principle 10 pushes toward access | Blocking is the exception, requiring a stated basis |

The engine serves three call sites: **Go-Live pre-flight** (seller PRD S6.4), **Boost campaign targeting**
([boost](./boost-mechanics.md) QV6, B4), and **viewer-side region filtering** ([discovery](./discovery-ux-spec.md) §3.3
G10).

---

## 2. Rule data model

One row per (category, country). This is the table counsel populates.

| Field | Type | Notes |
|---|---|---|
| `category_id` | enum | From §3 |
| `country` | ISO 3166-1 alpha-2 | Country granularity at MVP; sub-national only where a market demands it |
| `verdict` | enum | From §4 |
| `basis` | text | **Required for any non-permissive verdict** — the instrument or rule relied on. A verdict with no basis is not a rule, it is an opinion |
| `requires_permit` | bool | |
| `permit_type` | text | What the seller must hold |
| `age_gate` | enum | `none` / `18+` / `21+` / `market_specific` |
| `notice_required` | bool | Sensitive-content notice (Principle 10) |
| `commerce_modes_allowed` | set | Which of Exposure / Lead Gen / Invoice / Deposit are permissible |
| `seller_status_required` | enum | `any` / `business_plus` — e.g. where a market requires a registered trader |
| `effective_from` / `effective_to` | date | Rules change; the engine must know when |
| `reviewed_by` | text | Named counsel or firm |
| `reviewed_at` | date | |
| `review_due` | date | Quarterly by default (§8) |
| `rule_version` | int | §7 |
| `confidence` | enum | `reviewed` / `provisional` / `unreviewed` — §6 |

**`basis` and `reviewed_by` are the two fields that make this a rulebook rather than a guess.** A row without both is
`unreviewed` by definition, whatever its verdict field says.

---

## 3. Category taxonomy

A starter taxonomy, aligned to the moderation risk tiers so one category drives both legality and sampling intensity.
**Risk tier is mine; legality is not.**

| # | `category_id` | Moderation tier ([moderation](./moderation-operating-model.md) §4.3) | Typical legal sensitivity |
|---|---|---|---|
| 1 | `apparel_accessories` | Baseline | Low — counterfeit risk only |
| 2 | `handmade_crafts` | Baseline | Low |
| 3 | `home_garden` | Baseline | Low |
| 4 | `toys_games` | Baseline | Low — safety-standard risk |
| 5 | `books_media` | Baseline | Low — IP risk |
| 6 | `sports_outdoors` | Baseline | Low |
| 7 | `beauty_personal_care` | Baseline | Medium — cosmetics regulation |
| 8 | `electronics_general` | Baseline | Medium — compliance marking |
| 9 | `mobile_devices` | Baseline | Medium — IMEI and import rules |
| 10 | `jewellery_watches` | Elevated | Medium — hallmarking, counterfeit |
| 11 | `collectibles_antiques` | Elevated | Medium — cultural-property rules |
| 12 | `automotive_parts` | Elevated | Medium — safety-critical parts |
| 13 | `food_beverage` | Elevated | High — food safety, labelling |
| 14 | `supplements` | Elevated | High — health claims |
| 15 | `pet_animals` | Elevated | High — live-animal rules |
| 16 | `agriculture_seeds` | Elevated | High — phytosanitary |
| 17 | `industrial_machinery` | Elevated | Medium |
| 18 | `services_professional` | Elevated | High — licensed professions |
| 19 | `real_estate` | Elevated | High — brokerage licensing |
| 20 | `financial_services` | **Hot** | Very high — licensing, promotion rules |
| 21 | `pharmaceuticals` | **Hot** | Very high |
| 22 | `medical_devices` | **Hot** | Very high |
| 23 | `alcohol` | **Hot** | Very high — many markets prohibit |
| 24 | `tobacco_vaping` | **Hot** | Very high |
| 25 | `weapons_ammunition` | **Hot** | Very high — many markets prohibit |
| 26 | `adult_products` | **Hot** | Very high |
| 27 | `gambling_betting` | **Hot** | Very high |
| 28 | `crypto_digital_assets` | **Hot** | Very high — and see §9 |
| 29 | `cannabis_cbd` | **Hot** | Very high |
| 30 | `other_unclassified` | Elevated | Unknown by construction — §6 |

**`other_unclassified` is a real category, not a gap.** Sellers will describe things the taxonomy did not anticipate,
and the honest handling is to route them to elevated moderation and a conservative default rather than to force them
into an ill-fitting box.

---

## 4. Verdict vocabulary

| Verdict | Meaning | Engine behaviour |
|---|---|---|
| `PERMITTED` | No known restriction | Region included |
| `PERMITTED_WITH_NOTICE` | Lawful, sensitive | Region included; sensitive-content notice shown (Principle 10) |
| `PERMITTED_AGE_GATED` | Lawful, age-restricted | Region included; age gate enforced |
| `REQUIRES_PERMIT` | Lawful only with a permit the seller must hold | Included **only if** the seller's verified permit set satisfies `permit_type`; otherwise removed with that reason |
| `PROHIBITED` | Direct legal prohibition | Region removed, basis cited |
| `UNREVIEWED` | No counsel review exists for this cell | Resolved by the §6 default, and **always visible in ops** |

Separately, and not a category rule:

| Overlay | Scope | Behaviour |
|---|---|---|
| `SANCTIONED` | Entity or jurisdiction level | Blocks regardless of category (matrix R10). The one legitimate basis for blanket geographic blocking under Principle 10 |

**There is no `REJECTED`.** The vocabulary deliberately contains no verdict that can kill a campaign, because
Principle 11 does not permit one.

---

## 5. Evaluation algorithm

```
evaluate(category, target_regions[], seller_status, seller_permits[], today):
  included = []            # regions the campaign will run in
  removed  = []            # {region, reason, basis, remedy}

  for region in target_regions:
      if sanctioned(region) or sanctioned(seller):
          removed += {region, "sanctions", basis, remedy: none}
          continue

      rule = lookup(category, region, effective_on = today)
      if rule is None or rule.confidence == "unreviewed":
          rule = default_for(category)          # §6

      switch rule.verdict:
        PERMITTED:              included += region
        PERMITTED_WITH_NOTICE:  included += region  with notice
        PERMITTED_AGE_GATED:    included += region  with age_gate
        REQUIRES_PERMIT:
            if rule.permit_type in seller_permits (verified, unexpired):
                 included += region
            else removed += {region, "permit required",
                             basis, remedy: "hold " + permit_type}
        PROHIBITED:             removed += {region, "prohibited", basis, remedy: none}

      if rule.seller_status_required == business_plus and seller_status == individual:
            removed += {region, "registered trader required", basis,
                        remedy: "complete Business verification"}

  return { included, removed, rule_versions_used }
```

Four properties this must hold:

| # | Property |
|---|---|
| P1 | **Never returns a rejection.** If `included` is empty, the caller blocks the action and explains *per region* — the campaign still exists |
| P2 | **Every removal carries a reason, a basis and, where one exists, a remedy.** "Not available in your selected markets" is not an acceptable message |
| P3 | **Records `rule_versions_used`.** A dispute months later must be answerable against the rules as they stood, not as they now stand |
| P4 | **Deterministic and replayable.** Same inputs plus same rule versions plus same date produce the same output |

---

## 6. The unknown cell — the decision that matters most

There will be (category × country) cells with no review. With 30 categories and a global ambition there will be
thousands. What the engine does with them is a genuine policy choice, and neither extreme is right.

| Option | Effect |
|---|---|
| Default-permit everywhere | Maximises Principle 10 access; means unreviewed firearms and pharmaceutical broadcasts reach markets nobody checked |
| Default-deny everywhere | Legally safe; collapses Principle 10 to "wherever counsel got to first", and at launch that is almost nowhere |

**[My Recommendation] — default by risk tier, never globally:**

| Moderation tier | Default for an unreviewed cell |
|---|---|
| **Hot** (categories 20–29) | **`PROHIBITED`** — deny until reviewed. Unknown does not mean permitted for weapons or pharmaceuticals |
| **Elevated** (10–19, 30) | **`PERMITTED_WITH_NOTICE`** + elevated moderation sampling, flagged `provisional` |
| **Baseline** (1–9) | **`PERMITTED`**, flagged `provisional` |

And three rules that keep this honest rather than convenient:

1. **`provisional` is visible**, in the ops console and in the rule export. Nobody should be able to believe the matrix is reviewed when it is not.
2. **A market cannot launch** with `unreviewed` cells in any Hot category, or in any category the launch actually offers (§10).
3. **`provisional` has an expiry.** A cell still provisional after 90 days escalates to the policy owner rather than quietly becoming permanent.

The asymmetry is the point: the cost of wrongly permitting a baseline-tier craft broadcast is a takedown; the cost of
wrongly permitting a Hot-tier one is a regulatory event.

---

## 7. Versioning and audit

| # | Requirement |
|---|---|
| V1 | Rules are **immutable and versioned**. A change creates a new version with a new `effective_from`; nothing is edited in place |
| V2 | Every evaluation stores the rule versions it used (P3) |
| V3 | Every rule change records who changed it, when, on what basis, and what it replaced |
| V4 | The full matrix is **exportable** for counsel review — a spreadsheet they can read, not an API they cannot |
| V5 | Superseded rules are retained for the statutory dispute window |
| V6 | A rule change **never retroactively invalidates a completed broadcast**. It applies to evaluations from its `effective_from` forward |

V6 is a fairness rule as much as a technical one: a seller who broadcast lawfully on Tuesday under the rules of
Tuesday has not committed a violation because the rulebook changed on Thursday.

---

## 8. Ownership and cadence

| Artefact | Owner |
|---|---|
| Engine, data model, evaluation logic | Engineering |
| Category taxonomy | Policy lead + product |
| **Every cell's verdict, basis, permit type and age gate** | **Counsel, per market** |
| Risk tiering and default policy (§6) | Policy lead |
| Sanctions overlay | Compliance |
| Review cadence enforcement | Policy lead |

| Trigger | Action |
|---|---|
| New market opening | Full review of every category the market will offer, before launch |
| New category added | Review across all live markets before it is selectable |
| Quarterly | Review all Hot-tier cells in live markets |
| Annually | Review everything else |
| Regulatory change notice | Out-of-cycle review of affected cells |

**A rule nobody owns goes stale and is then enforced wrongly** — which is worse than having no rule, because it
carries the authority of the system while being incorrect.

---

## 9. Two boundaries worth stating

**Category 28, `crypto_digital_assets`.** The category exists in the taxonomy because sellers will attempt it, and the
engine must have somewhere to put it. This is entirely unrelated to LM: LM tokenomics, crypto, wallets, custody,
listing and AML/KYC are **[Deferred]** to a separate workstream and nothing in this rulebook designs or presumes
anything about them. A rule permitting or prohibiting third-party crypto *merchandise* in a market says nothing about
LM.

**Ad legality versus content moderation.** They are different systems with different inputs and must not be merged:

| | Policy Engine | Moderation |
|---|---|---|
| Asks | *May this category be advertised into this market?* | *Is what is happening on screen acceptable?* |
| Input | Declared category, target markets, permits | Live audio and video, chat, reports |
| Timing | Before Go-Live | During the session |
| Output | Region removals | Termination, ejection, takedown |

A seller can pass the Policy Engine and still be terminated by moderation, and the reverse is meaningless. Keeping
them separate is what makes each auditable.

---

## 10. Per-market delivery checklist for counsel

What must exist before a market opens. This is the hand-off artefact.

| # | Deliverable |
|---|---|
| 1 | A verdict, with `basis`, for **every category the market will offer** — no `unreviewed` cells in the offered set |
| 2 | Permit types named precisely enough for a seller to know what to obtain, and for review to verify it |
| 3 | Age-gate thresholds, and whether self-declaration suffices or stronger assurance is required (matrix R3) |
| 4 | Sensitive-content notice requirements and any mandated wording |
| 5 | Whether a registered-trader status is required to sell at all (matrix R1) |
| 6 | Which commerce modes are permissible — relevant to Phase-2 invoicing and payment (matrix R8) |
| 7 | Advertising-specific licensing or permit requirements for live commercial broadcasting (matrix R6) |
| 8 | Sanctions and export-control screening scope (matrix R10) |
| 9 | Retention and disclosure duties that interact with data minimisation (matrix R5) |
| 10 | A named reviewer and a review date on every row |

---

## 11. Illustrative rows — structure only

**These are not legal statements.** They exist solely to show the shape of a populated row.

| `category_id` | `country` | `verdict` | `basis` | `requires_permit` | `age_gate` | `notice` | `confidence` |
|---|---|---|---|---|---|---|---|
| `handmade_crafts` | `XX` | `PERMITTED` | — | no | none | no | `reviewed` |
| `supplements` | `XX` | `REQUIRES_PERMIT` | *[instrument — counsel]* | yes | none | yes | `reviewed` |
| `alcohol` | `XX` | `PROHIBITED` | *[instrument — counsel]* | — | — | — | `reviewed` |
| `beauty_personal_care` | `YY` | `PERMITTED_WITH_NOTICE` | *[instrument — counsel]* | no | none | yes | `provisional` |
| `weapons_ammunition` | `ZZ` | `PROHIBITED` | §6 default, unreviewed Hot tier | — | — | — | `unreviewed` |

The last row is the §6 default doing its job: no review exists, the tier is Hot, so the answer is no — and the row
says so plainly rather than looking like a finding.

---

## 12. Open items

| # | Item | Owner |
|---|---|---|
| 1 | Accept the §6 tier-based default policy | Owner + counsel |
| 2 | Beachhead markets — determines the entire population scope | Owner |
| 3 | Confirm the §3 taxonomy before it becomes load-bearing in ranking, moderation and rules simultaneously | Product + policy |
| 4 | Sub-national granularity — needed for some markets, avoided until one demands it | Counsel |
| 5 | Permit verification: which permits the platform verifies versus attests | Counsel + product |
| 6 | Whether `seller_status_required` is enforced at Go-Live or at account level | Product |

## 13. Assumptions

| # | Assumption | Validate with |
|---|---|---|
| A1 | Country granularity suffices at MVP | Counsel, per launch market |
| A2 | A 30-category taxonomy covers the launch offering | Pilot seller intake, and the `other_unclassified` rate |
| A3 | Tier-based defaults are an acceptable risk posture | Counsel |
| A4 | Counsel can deliver §10 per market within the launch timeline | **The schedule risk in this document** — it is external work on the critical path |
