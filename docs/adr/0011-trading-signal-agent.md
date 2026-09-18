# ADR-0011 — Trading domain: semi-automated daily Binance signal agent

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-18 |
| **Decision owners** | Engineering + Owner |
| **Relates to** | none — new, isolated domain; no dependency on LAHTHA/CLICK |

## Context

A separate mandate asks for a "semi-automated trading agent" targeting Binance Spot/Futures:
screen Binance-listed assets daily, emit exactly one risk-managed signal (entry zone, +5.0%
take-profit, 1.5–2.0% stop-loss, fractional-Kelly position size, ≤3x futures leverage), and track
portfolio equity against a $5,000 → $50,000 target while enforcing a 5% max-drawdown circuit
breaker. This has no relationship to LAHTHA/CLICK's device marketplace; it's added as its own
domain per an explicit product decision to host it in this backend rather than a separate service.

## Decision

Add a `trading` domain (`src/domains/trading/`) that generates and journals daily signals, but
**never places a live order and never holds Binance API credentials**. "Semi-automated" is read
literally: the service screens candidates and sizes a recommendation; a human decides whether to
execute it on Binance and reports the outcome back via `POST /trading/signals/:id/trades`, which
updates the portfolio ledger. Wiring up real order execution (private API keys, HMAC-signed
requests, real capital at risk from a bug) is a materially bigger, higher-stakes piece of work and
was intentionally left out of this change — see "Out of scope" below.

### Pipeline
1. **Liquidity gate** — Binance USDT spot pairs with 24h quote volume ≥ $10M and a bid/ask spread
   ≤ 0.5% (`screening.ts`).
2. **4-layer alpha filter** (3 layers are computable from Binance's public API; on-chain/mining
   metrics are not, and that layer is omitted rather than faked):
   - Order-book depth imbalance (bid vs. ask notional within 1% of the best price).
   - Derivatives: funding rate (penalizes crowded-long extremes) + open-interest expansion
     confirming a price breakout. Neutral (50) for spot-only symbols with no perpetual.
   - Technical confluence: Bollinger Band squeeze width, VWAP breakout, RSI momentum (bullish but
     not overbought).
3. **Selection** — highest composite score wins; below `MIN_COMPOSITE_SCORE` (55/100) → no signal
   for the day (`NoEligibleCandidatesError`, mapped to `204`).
4. **Sizing** (`risk.ts`) — stop-loss is chosen within [1.667%, 2.0%] so reward:risk always lands
   in [1:2.5, 1:3] against the fixed +5.0% take-profit; win probability is mapped from the
   composite score into a conservative [30%, 60%] band (never assumes a favorable edge by
   default); position size is half-Kelly, clamped to [2%, 20%] of portfolio equity.
5. **Drawdown breaker** — `generateDailySignal` refuses (`423`) when current equity has drawn down
   ≥5% from its peak, until a human intervenes.

### Money
Portfolio equity is stored as `equityUsdCents` (integer cents) per the platform's decimal-safety
NFR; the trade-outcome endpoint takes `realizedPnlUsdCents` as an integer from the caller, the same
pattern `priceHalalat` uses elsewhere. Market prices (`entryLow`/`takeProfit`/`stopLoss`) are plain
numbers, consistent with how exchange APIs quote them — a full decimal type there is future work.

### Wiring (no cycle)
`trading` has no dependency on `lahtha`/`iam` beyond `Authz` (session + RBAC), matching the
`payment`/`listing` pattern. New RBAC permissions `trading.signal.view` / `trading.portfolio.manage`
and role `admin.trading` (domain `trading`).

## Config
`BINANCE_SPOT_BASE_URL` / `BINANCE_FUTURES_BASE_URL` (public REST, no credentials),
`BINANCE_REQUEST_TIMEOUT_MS`, `TRADING_STARTING_EQUITY_USD_CENTS` (default $5,000),
`TRADING_TARGET_EQUITY_USD_CENTS` (default $50,000), `TRADING_CANDIDATE_POOL_SIZE`.

## Consequences
- **Positive**: the daily-signal mandate is implemented with real Binance market data, hard risk
  caps enforced in code (not just prose), and a portfolio journal a human can audit.
- **Negative / trade-offs**: no live execution means the "agent" still requires a human in the
  loop for every trade — by design, since automatically risking real capital from an LLM-driven
  service is a decision this ADR does not make unilaterally. On-chain/mining metrics (Phase 2 of
  the mandate) are out of scope for the same reason Binance doesn't expose them.
- **Data**: new `trading_signals` (unique `tradeDate` — enforces "exactly one per day"),
  `trading_portfolio`, `trading_trades` (unique `signalId` — enforces one outcome per signal)
  collections.

## Test plan
- `risk.test.ts` — stop-loss stays in [1.667%, 2.0%], RR stays in [1:2.5, 1:3], Kelly sizing is
  clamped and never negative, drawdown halt trips at exactly 5%.
- `screening.test.ts` — liquidity gate rejects low-volume/wide-spread symbols; scoring rewards
  bid-side depth, healthy funding + OI expansion, BB squeeze + VWAP breakout + RSI momentum.
- `trading-service.test.ts` — one signal per UTC day (idempotent), halts on drawdown, records a
  trade outcome exactly once per signal and updates equity/peak/win-loss.

## Out of scope (follow-ups)
Live order placement/cancellation against Binance (would need signed private-API requests, key
custody, and a much stronger safety review); on-chain/mining data via a third-party provider;
multi-asset portfolios; a UI for the daily signal (today it's API-only).
