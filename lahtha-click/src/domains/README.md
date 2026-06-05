Domain folders land here as workstreams 2+ ship:

- `lahtha/` — vendor approval (shipped), IMEI inventory, checkout state machine, ownership transfer
  - `vendor/` — vendor approval lifecycle + Rule 4 CLICK gate + audit (Workstream 2, IAM)
- `click/` — wallet ledger, auctions, bidding
- `shared/` — cross-domain primitives (sync_events, saga orchestrator)
