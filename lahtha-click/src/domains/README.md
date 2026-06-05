Domain folders land here as workstreams 2+ ship:

- `iam/` — vendor identity, passwordless OTP auth, opaque scoped sessions, MFA step-up (Microsoft Entra) (Workstream 2, IAM)
- `lahtha/` — vendor approval (shipped), IMEI inventory, checkout state machine, ownership transfer
  - `vendor/` — vendor approval / KYC lifecycle + Rule 4 CLICK gate + audit (Workstream 2, IAM)
- `click/` — wallet ledger, auctions, bidding
- `shared/` — cross-domain primitives (sync_events, saga orchestrator)
