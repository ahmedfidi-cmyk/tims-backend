# Invoicing Overview — Stakeholder View

> Step 2 of the foundation: what invoicing looks like for the people who actually touch it. Not the protocol detail (see [`../architecture/zatca-integration.md`](../architecture/zatca-integration.md) for that).

## The simple model
Every order produces **one** tax invoice. The buyer always gets it. The seller always sees it. The state always has it. No exceptions.

```
Order paid  →  Invoice generated  →  Buyer gets PDF + QR  →  ZATCA gets the data
              (instant, automatic)    (email + dashboard)     (cleared B2B / reported B2C)
```

## Who sees what

| Stakeholder | Where | What they see |
|---|---|---|
| **End customer** | Order confirmation email + "My Orders" page | PDF invoice, QR code, order total, VAT, payment method |
| **Vendor** | "My Sales" page | Same invoice, plus the platform commission line + their net |
| **Dealer** (CLICK auction) | "Auction Wins" page | Same invoice, plus seller dealer's payout reference |
| **Admin** | Admin → Finance | All invoices, status, ability to issue refunds / credit notes |
| **Accountant / ZATCA** | API export + ZATCA portal | Signed XML + cleared/reported status |

## What's on the invoice (kept simple)

Standard fields, nothing exotic:

- Invoice number (sequential, no gaps)
- Issue date + time
- Supplier (LAHZA Trading) — VAT number, address
- Buyer — name, VAT number if B2B
- Line items — description, IMEI for devices, unit price, qty, VAT
- Totals — subtotal, VAT (15%), grand total
- Payment method (visible)
- Commission line (vendor view only)
- ZATCA QR code (always)

## The two invoice types (KSA reality)

| Type | When | What's different |
|---|---|---|
| **Simplified (B2C)** | Customer is an individual | Smaller, QR-driven, reported to ZATCA within 24h |
| **Standard (B2B)** | Buyer has a VAT number | Full buyer details, cleared by ZATCA in real-time before delivery |

The system detects which type to issue based on whether the buyer has registered a VAT number — no manual choice.

## Refunds and credit notes
- A refund creates a **credit note** referencing the original invoice (legal requirement; never edit the original).
- Customer sees both documents in their dashboard.
- Vendor sees the commission reversal automatically.
- ZATCA gets the credit note the same way as the invoice.

## What stakeholders care about (and we deliver)

| Concern | Delivery |
|---|---|
| "Is this a real invoice?" | ZATCA QR + cleared/reported stamp |
| "Can I download it?" | PDF in dashboard + emailed link |
| "Will I get the VAT back?" (B2B) | Yes — invoice has buyer VAT number |
| "How much did the platform take?" (vendor) | Commission line visible on every invoice |
| "What if I refund?" | Auto credit note + customer sees both |
| "Can my accountant export?" | CSV export by date range (admin + vendor) |

## What's deferred to later phases

- Multi-supplier marketplace invoices (LAHZA is single-supplier in Phase 1).
- Self-billing for dealer-to-dealer settlements (Phase 3).
- Invoice translations beyond Arabic + English (not needed yet).
- Cryptographic invoice chain auditability for users (the underlying hash chain exists per architecture, but exposing it to end users is a future feature).

## Phase 1 acceptance from this view

- [ ] A customer can complete an order and immediately see + download a valid ZATCA invoice.
- [ ] A vendor can open the same order and see the commission and their net.
- [ ] A refund issues a credit note that both parties can see.
- [ ] Admin can export a date range as CSV.
