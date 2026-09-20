# ADR-0012 — Trading domain: opt-in live Binance order execution

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-20 |
| **Decision owners** | Owner (explicit request, after being asked to confirm the risk model) |
| **Extends** | [ADR-0011](./0011-trading-signal-agent.md) — the daily signal generator this executes against |

## Context

ADR-0011 deliberately scoped the trading domain to signal generation only, holding no
Binance credentials and placing no live orders, because wiring up real order execution is a
materially bigger, higher-stakes piece of work. The owner has since asked for that follow-up
explicitly, and confirmed three risk decisions when asked directly:

1. Start on **Binance Testnet** before ever touching the real account.
2. Execution should be **fully automatic** — no manual per-trade confirmation step.
3. Add a **hard per-trade USD cap**, independent of the Kelly-sized `allocationPct`, as a
   second ceiling that doesn't depend on the risk math being correct.

The owner also offered to paste a Binance API key into the chat — this was declined and
redirected: a chat transcript is not a secrets store. Credentials are configured as
environment variables in the deployment, the same seam every other credential in this repo
uses (`MOYASAR_API_KEY`, `S3_SECRET_ACCESS_KEY`, …).

## Decision

Add a live-execution seam behind `OrderExecutionPort` (`execution-types.ts`), gated by
`BINANCE_EXECUTION_ENABLED` and defaulting to **off**. `createTradingService()` and the
signal-generation flow work identically whether or not execution is configured — this ADR
only adds a second, independent thing that can happen after a signal is generated.

### Fail-closed defaults
- `BINANCE_EXECUTION_ENABLED` defaults to `false`. Unset, the domain behaves exactly as
  ADR-0011 describes it (`NoopExecutionPort` — every method throws
  `ExecutionNotConfiguredError` if it's ever reached, which it isn't while disabled).
- `BINANCE_TRADING_ENV` defaults to `testnet`. Reaching `mainnet` requires **both**
  `BINANCE_TRADING_ENV=mainnet` **and** `BINANCE_MAINNET_CONFIRM=I_UNDERSTAND_THE_RISK` set
  exactly — config validation refuses to start otherwise (`config/index.ts` `superRefine`).
  This means flipping one env var can never silently move from testnet to real money.
- Enabling execution without `BINANCE_API_KEY`/`BINANCE_API_SECRET` also fails config
  validation at startup, not at first order-placement.

### "Fully automatic" — how it's wired
`GET /trading/signal/today` (the same idempotent, once-per-UTC-day call ADR-0011 defined)
now also calls `ExecutionService.executeSignal(signal)` when an execution service is mounted.
There is no separate confirmation endpoint. `executeSignal` is itself idempotent per
`signalId` (checks `ExecutionRepository.findBySignal` first), so whatever repeatedly calls
this endpoint (still no scheduler ships in this repo — an external cron per ADR-0011) can't
double-place an order.

### Sizing: two independent caps
`notionalUsd = min(equityUsdCents/100 * signal.allocationPct, MAX_TRADE_NOTIONAL_USD)`
(`execution.service.ts`). `MAX_TRADE_NOTIONAL_USD` (default $250) is a flat dollar ceiling
that holds even if the Kelly/score math in ADR-0011 is ever wrong or gamed — it's the safety
net the owner asked for.

### What a "position" is
- **Spot**: a `MARKET` buy sized by `quoteOrderQty` (so Binance computes the exact fill from
  the USD amount, sidestepping our own step-size rounding on entry), immediately followed by
  an OCO sell (`LIMIT_MAKER` take-profit + `STOP_LOSS_LIMIT` stop-loss) for the exact executed
  quantity.
- **Futures**: leverage is set to `MAX_LEVERAGE` (3x, from `risk.ts` — the same cap ADR-0011's
  signal already respects) before entry; entry is a `MARKET` buy; TP/SL are separate
  `reduceOnly` `TAKE_PROFIT_MARKET`/`STOP_MARKET` orders, so they can only ever close the
  position, never open a new one.
- Every quantity/price is rounded to the symbol's live `LOT_SIZE`/`PRICE_FILTER` from
  `exchangeInfo` before being sent — Binance rejects orders that don't comply.

### Settlement — reconciliation, not a WebSocket listener
A full Binance user-data-stream listener (listenKey lifecycle, reconnect/backoff, session
management) is a substantial piece of infrastructure in its own right and is **out of scope**
here. Instead, `ExecutionService.syncExecution(signalId)` polls the TP/SL order status via
`GET /order` (spot) / `GET /fapi/v1/order` (futures) and, once one side has `FILLED`, computes
realized P&L and journals it through the exact same `portfolio-ledger.ts` path a manually
reported trade uses (`applyTradeOutcome` — extracted from `TradingService.recordTradeOutcome`
in this change so both paths can share it without a circular dependency between
`TradingService` and `ExecutionService`). Call `POST /trading/signals/:id/execution/sync`
from an external cron until a proper listener is built.

### Kill switch
`PortfolioState.executionPaused` (new field) and `POST /trading/execution/pause` /
`POST /trading/execution/resume` (both gated by `trading.portfolio.manage`) let an operator
stop new live orders immediately without a redeploy or touching `BINANCE_EXECUTION_ENABLED`.
`executeSignal` checks this before ever calling the venue.

### Errors are never silent, never re-attempted automatically
A failed `openPosition` call (insufficient balance, a rejected order, a network error) is
caught and journaled as an `ExecutionRecord` with `status: 'failed'` and the error message —
it does **not** throw out of `executeSignal`, so a broken exchange call can't break signal
generation, and it does **not** retry, so a transient failure can't silently double-enter a
position on a retry. `GET /trading/executions` is where a human sees and acts on a failure.

## Config
`BINANCE_EXECUTION_ENABLED` (default `false`), `BINANCE_TRADING_ENV` (default `testnet`),
`BINANCE_API_KEY` / `BINANCE_API_SECRET` (required together when enabled),
`BINANCE_SPOT_TESTNET_BASE_URL` / `BINANCE_FUTURES_TESTNET_BASE_URL`, `BINANCE_MAINNET_CONFIRM`
(required exact-match string to run mainnet), `MAX_TRADE_NOTIONAL_USD` (default `250`).

## Consequences
- **Positive**: the owner's three explicit requirements (testnet-first, fully automatic,
  hard dollar cap) are each enforced in code, not just documented; nothing here can activate
  without a deliberate, multi-step opt-in even after this PR merges.
- **Negative / trade-offs**: settlement is poll-based, not event-driven — a position that
  closes won't be journaled until something calls the sync endpoint, so equity/drawdown can
  lag reality between syncs; a real deployment needs an external scheduler for both
  `GET /trading/signal/today` and `POST .../execution/sync` since this repo has none. Not
  exercised against live Binance testnet or mainnet endpoints in this environment (no
  outbound network route to Binance here) — this **must** be smoke-tested on testnet before
  `BINANCE_TRADING_ENV=mainnet` is ever set, and the OCO/futures endpoint paths re-verified
  against Binance's current API docs, since exchanges do version these.
- **Data**: new `trading_executions` collection (unique `signalId` — one execution per
  signal); `PortfolioState` gains `executionPaused`.

## Test plan
- `tests/trading-execution.test.ts` — execution no-ops while disabled; places and journals an
  order when enabled; caps notional at `MAX_TRADE_NOTIONAL_USD` even when the Kelly allocation
  asks for more; is idempotent per signal (no double order); records a `failed` record instead
  of throwing when the venue rejects the order; respects the pause/resume kill switch;
  `syncExecution` leaves an unfilled position alone, journals a take-profit close as a win
  (equity up) and a stop-loss close as a loss (equity down) through the shared ledger, is
  idempotent (no double-journal on repeat sync), and raises `ExecutionNotFoundError` for an
  unknown signal.
- Existing `trading-service.test.ts` (10 tests) required no changes — `TradingService`'s
  public behavior is unchanged; its ledger logic was extracted into `portfolio-ledger.ts`,
  not rewritten.

## Out of scope (follow-ups)
A real user-data-stream listener (replacing polling); multi-asset/portfolio execution;
partial-fill handling beyond what Binance's own OCO/reduce-only orders provide; a UI for
pause/resume and execution history (API-only today, same as ADR-0011's signals).
