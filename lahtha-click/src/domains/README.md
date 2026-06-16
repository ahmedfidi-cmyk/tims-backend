Domain folders land here as workstreams 2+ ship:

- `iam/` — vendor identity, passwordless OTP auth, opaque scoped sessions, MFA step-up (Microsoft Entra) (Workstream 2, IAM)
  - `rbac/` — persons, users (multi-principal), seed roles/permissions, `requirePermission` + access_audit (Workstream 2, IAM)
- `lahtha/` — vendor approval (shipped), IMEI inventory (shipped), checkout (shipped), ownership transfer
  - `vendor/` — vendor approval / KYC lifecycle + Rule 4 CLICK gate + audit (Workstream 2, IAM)
  - `inventory/` — IMEI device registration, append-only ownership, proof docs (Workstream 3)
  - `checkout/` — dual-path order state machine, payment seam, in-process ownership transfer (Workstream 4)
  - `listing/` — priced vendor offers for the storefront; order places from a listing + marks it sold (ADR-0006)
- `click/` — wallet ledger, auctions, bidding
- `shared/` — cross-domain primitives (sync_events, saga orchestrator)
