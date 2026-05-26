# Commission Policy — ≤ 5% per Order

> Step 4 of the foundation: the commercial + programmatic mechanism for platform commission. Hard cap: **5% per order, total, across both sides**.

## The promise to users

| Audience | Promise |
|---|---|
| **End customer** | Price shown = price paid. We never add a surprise fee at checkout. |
| **Vendor (LAHZA)** | You keep 95% of every sale, after VAT. No tiers, no negotiation games. |
| **Dealer (CLICK)** | Total platform cut never exceeds 5% on any auction. Split fairly between buyer and seller. |

The commission funds the platform: hosting, support, dispute resolution, ZATCA filing, payment processing, fraud prevention.

## The numbers

| Surface | Rate (bps) | % | Charged to | Notes |
|---|---|---|---|---|
| LAHZA primary sale (B2C) | `500` | 5.00% | Vendor | Deducted from the vendor payout; never added to customer price |
| CLICK auction settlement | `500` total | 5.00% total | Split 50/50 | `250` bps (2.5%) from buyer dealer, `250` bps (2.5%) from seller dealer |
| Withdrawal from CLICK wallet | `0` | 0.00% | — | We do not charge for withdrawals. The bank may. |
| Refunds | proportional reversal | — | — | Commission credited back on full refund; partial reversal on partial refund |

**Hard ceiling**: a constant `MAX_RATE_BPS = 500` in code rejects any rule that would push a single order over 5%. This is enforced both at config-load time and at invoice-generation time.

## Why "≤ 5%" is the right number

- **Competitive ceiling for KSA marketplaces**: Mobile-resale apps in the region commonly charge 7–12%. 5% positions LAHZA as the most vendor-friendly platform at launch.
- **Covers our floor cost** (payment processing ~2.5% + ZATCA + support overhead) with a thin but real margin.
- **One number is memorable**: vendors and customers can repeat "5%" without reaching for a calculator. That builds trust faster than a tiered table.
- **Headroom for promotions**: we can drop commission to 3% for a launch month and the message ("اشتراك المنصة ٣٪ بدلاً من ٥٪") lands instantly.

## Why split 50/50 on auctions

On CLICK, both the buying dealer and the selling dealer benefit from the marketplace existing. Charging both sides 2.5% (instead of 5% one-side) accomplishes three things:

1. **Buyer's effective price is more transparent** — they see "winning bid + 2.5% platform fee", not a hidden seller markup.
2. **Sellers list at honest prices** — they know exactly what they net.
3. **No race-to-the-bottom on listing fees** — neither side feels singled out.

## Calculation rules

1. **Money is integer halalat.** 1 SAR = 100 halalat. No floats.
2. **Round down** (`Math.floor`) at the smallest unit — the platform never collects half-halalat fractions; vendor keeps the leftover.
3. **VAT is excluded from the commission base.** Commission is calculated on the subtotal, then VAT is added on top.
4. **Min/max fee guards** can clamp small or huge orders (configurable, off by default in Phase 1).
5. **Refunds** reverse commission in proportion to the refunded amount.

Worked example for a LAHZA 5,000 SAR order:
```
Subtotal             4347.83 SAR  (price ex-VAT)
VAT (15%)              652.17 SAR
Customer pays        5000.00 SAR  ← what the buyer sees from the start

Commission base      4347.83 SAR  (subtotal, ex-VAT)
Commission (5%)       217.39 SAR  ← floor() at halalat
Vendor net           4130.44 SAR
ZATCA gets the VAT     652.17 SAR
```

## Commercial mechanics: how vendors see this

The vendor onboarding screen states the rate in plain Arabic — once, clearly:

> "عمولة المنصة ٥٪ من سعر البيع قبل ضريبة القيمة المضافة. لا توجد رسوم خفية، ولا اشتراك شهري."

Every sales row shows `Gross | Commission | Net` columns. Every payout summary itemizes commission per order. No vendor should ever need to email support to understand a deduction.

## Commercial mechanics: how customers see this

Customers do **not** see commission as a line item. They see one price, VAT inclusive. The commission is the platform's relationship with the vendor — exposing it to the customer would create false impressions about "discounting".

This is consistent with how Amazon, Noon, and Apple's resellers present price to buyers.

## Programmatic implementation

The hard ceiling and the rate table live in code at [`lahtha-click/src/config/commission.ts`](../../lahtha-click/src/config/commission.ts):

- `MAX_RATE_BPS = 500` — enforced at module load and per-call.
- `COMMISSION_DEFAULTS` table — current rates per surface.
- `computeCommissionHalalat(amount, type)` — pure function, integer math, deterministic.
- Test suite covers the ceiling, rounding, and refund proportionality.

A future migration can move the rate table from code into the database (so ops can adjust without a deploy). For Phase 1, code is the source of truth — changes go through PR review, which is the right friction for a number that affects every transaction.

## Promo & override policy (Phase 1)

- **No per-vendor overrides** in Phase 1. Single rate for all.
- **Platform-wide promo** can drop the rate temporarily — implemented as a feature flag, time-bounded, audit-logged.
- **No "negotiated rates" via support.** Vendors who ask are told the same thing: 5%, no exceptions, no exceptions for anyone, that's how we keep the system fair.

## Acceptance

- [ ] Code rejects any rule with `rateBps > 500` at module load.
- [ ] `computeCommissionHalalat` matches the worked example to the halalat.
- [ ] Every vendor invoice surfaces gross/commission/net.
- [ ] Customer-facing pages never display the word "commission".
- [ ] Refund flow reverses commission proportionally (covered by saga compensation).
