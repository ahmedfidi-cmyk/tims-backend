# CLICK Wallet Ledger — Schema & Bookkeeping

> Follow-up to [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §3.4 (CLICK Wallet Ledger). Pairs with [`auction-concurrency.md`](./auction-concurrency.md) for the locking story.

## Principles
1. **Double-entry bookkeeping**: every transaction is two equal-and-opposite postings. The ledger always balances to zero.
2. **Append-only entries**: corrections are reversal entries, never UPDATE/DELETE.
3. **Balances are a materialized projection** of the ledger — recoverable from entries alone.
4. **Money is `NUMERIC(18,2)`**, never `FLOAT`. Decimal-safe arithmetic only.

## Chart of accounts (Phase 1)
| Account ID | Owner | Type | Meaning |
|---|---|---|---|
| `dealer:<dealer_id>:available` | dealer | liability | what we owe the dealer, spendable |
| `dealer:<dealer_id>:reserved` | dealer | liability | held for open auctions/bids |
| `dealer:<dealer_id>:payable` | dealer | liability | won as a seller, awaiting payout |
| `click:fees` | platform | revenue | platform commission |
| `click:cash:bank:<bank_id>` | platform | asset | cash sitting in a real bank account |
| `click:suspense` | platform | clearing | unmatched inbound transfers (cleared by ops) |

Conservation: total liabilities to dealers == total `click:cash:*` minus revenue minus suspense. A reconciliation job verifies this every hour.

## Schema

```sql
CREATE TABLE accounts (
  account_id       TEXT PRIMARY KEY,
  account_type     TEXT NOT NULL CHECK (account_type IN ('asset','liability','revenue','clearing')),
  owner_type       TEXT NOT NULL CHECK (owner_type IN ('dealer','platform')),
  owner_ref        TEXT,                              -- dealer_id, bank_id, NULL for platform-wide
  currency         CHAR(3) NOT NULL DEFAULT 'SAR',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ledger_entries (
  entry_id         BIGSERIAL PRIMARY KEY,
  transaction_id   UUID NOT NULL,                     -- groups the two sides
  account_id       TEXT NOT NULL REFERENCES accounts(account_id),
  direction        CHAR(1) NOT NULL CHECK (direction IN ('D','C')),
  amount           NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency         CHAR(3) NOT NULL,
  reason_code      TEXT NOT NULL,                     -- 'bid.reserve', 'auction.capture', etc.
  reference_type   TEXT,                              -- 'auction', 'order', 'payout', etc.
  reference_id     UUID,
  posted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_by        TEXT NOT NULL                      -- 'system:saga' | 'admin:<user_id>'
);

CREATE INDEX ledger_by_account_time
  ON ledger_entries (account_id, posted_at DESC);
CREATE INDEX ledger_by_transaction
  ON ledger_entries (transaction_id);
CREATE INDEX ledger_by_reference
  ON ledger_entries (reference_type, reference_id);
```

### Double-entry invariant
For every `transaction_id`, sum of debits = sum of credits. Enforced by a constraint trigger:
```sql
CREATE OR REPLACE FUNCTION enforce_balanced_transaction() RETURNS trigger AS $$
DECLARE
  debit_total  NUMERIC(18,2);
  credit_total NUMERIC(18,2);
BEGIN
  SELECT COALESCE(SUM(amount) FILTER (WHERE direction='D'), 0),
         COALESCE(SUM(amount) FILTER (WHERE direction='C'), 0)
    INTO debit_total, credit_total
    FROM ledger_entries
   WHERE transaction_id = NEW.transaction_id;

  IF debit_total <> credit_total THEN
    RAISE EXCEPTION 'transaction % unbalanced: D=% C=%',
      NEW.transaction_id, debit_total, credit_total;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_balanced_transaction();
```
`DEFERRABLE INITIALLY DEFERRED` lets us insert both sides in any order within the same transaction; the check runs at COMMIT.

## Materialized balances
```sql
CREATE TABLE account_balances (
  account_id       TEXT PRIMARY KEY REFERENCES accounts(account_id),
  balance          NUMERIC(18,2) NOT NULL DEFAULT 0,
  last_entry_id    BIGINT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
Updated by the same transaction that inserts entries (within `SELECT ... FOR UPDATE` on the balance row — see [`auction-concurrency.md`](./auction-concurrency.md)). A nightly job rebuilds balances from `ledger_entries` and alerts on drift.

`dealer_wallets` from `auction-concurrency.md` is a **denormalized view** over `account_balances` for the three dealer accounts (`available`, `reserved`, `payable`).

## Canonical flows

### 1. Dealer tops up wallet (5,000 SAR via Moyasar)
```
TX abc-001 (reason='wallet.topup')
  D click:cash:bank:moyasar         5000.00
  C dealer:<d1>:available           5000.00
```

### 2. Dealer reserves 2,000 SAR on an open auction bid
```
TX abc-002 (reason='bid.reserve', reference=auction:a1)
  D dealer:<d1>:available           2000.00
  C dealer:<d1>:reserved            2000.00
```
Note both legs are inside the same dealer's books — net zero to the dealer, but it moves funds between sub-accounts so they can't double-spend.

### 3. Dealer is outbid → release
```
TX abc-003 (reason='bid.release', reference=auction:a1)
  D dealer:<d1>:reserved            2000.00
  C dealer:<d1>:available           2000.00
```

### 4. Dealer wins auction → capture
```
TX abc-004 (reason='auction.capture', reference=auction:a1)
  D dealer:<d1>:reserved            2000.00
  C dealer:<seller>:payable         1900.00
  C click:fees                       100.00
```
(5% commission illustrative — actual rate from config table.)

### 5. Seller dealer requests payout
```
TX abc-005 (reason='payout.request', reference=payout:p1)
  D dealer:<seller>:payable         1900.00
  C click:cash:bank:default         1900.00
```

### 6. Correction (admin reverses TX abc-004)
```
TX abc-006 (reason='reversal', reference=transaction:abc-004)
  C dealer:<d1>:reserved            2000.00
  D dealer:<seller>:payable         1900.00
  D click:fees                       100.00
```
The original entries stay. The reversal is a new transaction with opposite directions.

## Reconciliation
Hourly job:
```sql
WITH sums AS (
  SELECT account_id,
         SUM(CASE WHEN direction='C' THEN amount ELSE -amount END) AS computed
    FROM ledger_entries
   GROUP BY account_id
)
SELECT b.account_id, b.balance, s.computed, (s.computed - b.balance) AS drift
  FROM account_balances b
  JOIN sums s USING (account_id)
 WHERE s.computed <> b.balance;
```
Any non-empty result = page on-call. (For liability accounts, expected balance is the credit sum; the sign convention is encoded per account_type when projecting.)

## Auditability
- Ledger entries are append-only at the DB level: `REVOKE UPDATE, DELETE ON ledger_entries FROM app_user`.
- `posted_by` records the actor — system saga, admin override, or reconciliation job.
- Every `reason_code` is in a static enum table; new codes require a migration (forces deliberate change).

## Out of scope (Phase 1)
- Multi-currency (Phase 3, when expanding regionally).
- Real-time bank integration via SAMA APIs (deferred — Phase 1 uses payouts via SARIE batch).
- General ledger export to ERP (NetSuite/Odoo) — Phase 2.
