# ADR-0003 — Inventory / IMEI: Mongo + Hexagonal Implementation of Workstream 3

| | |
|---|---|
| **Status** | Proposed |
| **Date** | 2026-06-06 |
| **Decision owners** | Engineering + Owner |
| **Relates to** | [`../architecture/imei-inventory-schema.md`](../architecture/imei-inventory-schema.md) (schema design, §3), [`../architecture/iam-rbac.md`](../architecture/iam-rbac.md) (permissions) |
| **Builds on** | The IAM auth↔user bridge (session principal + `requirePermission`) |

## Context

[`imei-inventory-schema.md`](../architecture/imei-inventory-schema.md) specifies the inventory model in **PostgreSQL** (devices, append-only ownership, proof documents) with DB-level IMEI uniqueness and an ownership invariant. The implemented backend (`lahtha-click`) is **Node + TypeScript + Express + MongoDB (Mongoose) + Zod + Pino**, following a pure-core + ports/adapters layout (see the `vendor/` and `iam/` domains).

Workstream 3's acceptance bar is: *a vendor can register an IMEI with proof docs*. This is the first feature to consume the IAM bridge — every inventory write must be authorized by the **session-derived principal** via `requirePermission`, not a header.

This ADR records how the Postgres-described schema is realized on Mongo without losing its guarantees, and which authorization model applies.

## Decision

Implement Workstream 3 as a new domain `src/domains/lahtha/inventory/`, mirroring the existing pure-core + ports/adapters pattern, with three collections and code-layered validation.

### 1. Collections & invariants (Mongo translation)

| Postgres construct | Mongo realization |
|---|---|
| `devices.imei` UNIQUE, `imei2` partial UNIQUE, `serial_number` UNIQUE | unique index on `imei`; **sparse** unique on `imei2`; unique on `serialNumber` |
| `device_ownership` one-current-owner partial unique | unique index on `{ deviceId }` with `partialFilterExpression: { releasedAt: null }` |
| `device_documents (s3_bucket, s3_key)` UNIQUE | compound unique index |
| Append-only history | no UPDATE of historical rows; transfer = release current + insert new |

Global IMEI uniqueness and "exactly one current owner" are enforced at the **database layer** (indexes), not only in code — preserving the design's core guarantee.

### 2. Ownership transfer without multi-document transactions

CI runs a single-node `mongo:7` (no replica set → no multi-doc transactions). Transfer is therefore an **atomic compare-and-set** rather than a SQL `BEGIN…COMMIT`:

1. `findOneAndUpdate({ deviceId, releasedAt: null }, { $set: { releasedAt: now } })` — atomically claims the current ownership row; a losing concurrent caller gets `null`.
2. Insert the new ownership row (`releasedAt: null`).

The partial-unique index is the backstop: it makes a double-current-owner physically impossible even under a race. This is the same compare-and-set discipline already used in vendor approval.

### 3. Authorization — the IAM bridge in action

Routes are gated by the **session-based** `authz.requirePermission` (actor = `session.userId`, checked against live RBAC state, audited):

| Action | Permission | Seed role |
|---|---|---|
| Register device (+ mandatory invoice) | `lahtha.device.register` | `vendor.warehouse_manager` |
| Upload / attach document | `lahtha.document.upload` | `vendor.warehouse_manager` |
| List / read devices | `lahtha.device.list` | `vendor.owner`, `vendor.warehouse_manager` |
| Ownership transfer / custody | `lahtha.state.override` | `admin.ops` |

This requires the IAM module to **export its `authz`** so the inventory router can reuse it (small wiring addition). A vendor must be an **active** principal holding the role — which is the downstream effect of LAHTHA approval — so no separate approval check is duplicated here.

### 4. Code-layered validation (above the DB)

1. **Luhn checksum** on IMEI (pure `imei.ts`) before insert — the index only enforces 15-digit shape.
2. **Model-code allowlist** (seed `model-catalog.ts`) — unknown codes rejected (`422`).
3. **Mandatory `supplier_invoice`** at registration — device + initial ownership (`initial_registration`, ownerType `vendor`) + invoice document are created together; on partial failure the device write is compensated.
4. **No self-transfer** — reject when new owner == current owner.
5. Device lifecycle state is **derived** from the ownership chain (no stored `status` column), per the architecture doc.

### 5. Object storage as a seam

An `ObjectStoragePort` (`presignUpload`, `headObject`) abstracts S3. Phase 1 ships a **stub adapter** (deterministic local URL + recorded metadata); real S3 (versioning, Object Lock governance mode, KMS, ≤15-min presigned URLs, 7-year retention) is a documented follow-up — the same "wired seam, no credentials" approach used for `EntraMfaVerifier`.

## Consequences

### Positive
- Preserves the schema's hard guarantees (uniqueness, single owner) at the DB layer on Mongo.
- First real consumer of the IAM bridge — authorization is session-derived and audited end-to-end.
- Fully unit-testable without a live DB (in-memory adapters), consistent with the codebase.

### Negative / trade-offs
- No multi-doc ACID transaction in Phase 1; registration's multi-write step relies on unique indexes + compensation rather than a single atomic commit. Acceptable for single-node Phase 1; revisit when a replica set is available.
- Device state is derived (not stored), so listing/sold states arrive with later workstreams (checkout, auctions) — W3 covers registration, ownership, and documents only.

### Migration
- New `*-inventory.cjs` migrate-mongo migration creates `devices`, `device_ownership`, `device_documents` with the indexes above. Phase 1 launches with empty inventory (no data migration).

## Test plan (~35 tests, no live DB)
- Pure: Luhn vectors + IMEI shape; model allowlist; ownership-derived state.
- Service: register with mandatory invoice; duplicate IMEI → conflict; transfer happy path + no-self-transfer + single-current-owner invariant under contention.
- HTTP: permission gating via the session principal (incl. a vendor lacking `lahtha.device.register` → `403`).

## Open questions (to resolve after PR #19 merges)
1. **Mount path** — `/lahtha/devices` (recommended) vs `/lahtha/inventory/*`.
2. **Transfer endpoint scope in W3** — ship now as `admin.ops`-gated, or defer until checkout needs it.
3. **GSMA blacklist / customs checks** — confirmed out of scope for Phase 1 (per the schema doc); revisit in Phase 2.
