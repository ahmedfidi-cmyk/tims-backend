# LAHTHA & CLICK — Backend

Phase 1 bootstrap implementing [Workstream 1](../docs/architecture/README.md#phase-1-implementation-roadmap) of the architecture roadmap: repo skeleton + MongoDB + migration tooling + health endpoint + CI.

> **Stack note**: implementation uses **Node.js 20 + TypeScript + Express + MongoDB (Mongoose) + migrate-mongo**, matching the existing repo's tooling. The architecture docs under [`../docs/architecture/`](../docs/architecture/) currently describe a PostgreSQL design — a docs-alignment pass is tracked as a follow-up.

This workspace lives alongside the existing weather/CV code in this repository without touching it.

## Setup

```bash
cd lahtha-click
npm install
cp .env.example .env
# edit .env if your local MongoDB is not on the default URI
```

## Database migrations

The baseline migration creates the `sync_events` collection (the LAHTHA ↔ CLICK event bus) with required indexes.

```bash
npm run migrate:status   # see pending migrations
npm run migrate:up       # apply all pending
npm run migrate:down     # revert the last
npm run migrate:create   # scaffold a new migration
```

## Running

```bash
npm run dev       # tsx watch
npm run build     # compile TS to dist/
npm start         # run compiled
```

Endpoints:
- `GET /health` — liveness; always 200 if the process is up.
- `GET /ready`  — readiness; 200 only when MongoDB is connected.

### Vendor approval (Workstream 2 — IAM)

The LAHTHA vendor lifecycle and its **Rule 4** gate (a vendor must be
`LAHTHA_APPROVED` before it can participate in CLICK). Every transition writes an
append-only audit record (**Rule 20**). State machine:

```
PENDING_OWNERSHIP_PROOF --submit proof--> PENDING_REVIEW --approve--> LAHTHA_APPROVED
                          ^                       |
                          |                       └--reject--> REJECTED
                          └--------resubmit proof---------------────┘
```

| Method & path | Purpose |
|---|---|
| `POST /lahtha/vendors` | Register a vendor (starts in `PENDING_OWNERSHIP_PROOF`). |
| `GET /lahtha/vendors/:id` | Fetch a vendor. |
| `POST /lahtha/vendors/:id/ownership-proof` | Submit CR/VAT/ownership proof → `PENDING_REVIEW`. |
| `POST /lahtha/admin/vendors/:id/approve` | Admin approval (only from `PENDING_REVIEW`). |
| `POST /lahtha/admin/vendors/:id/reject` | Admin rejection with a reason (resubmission allowed). |
| `GET /lahtha/vendors/:id/click-access` | Rule 4 gate — whether CLICK is unlocked. |
| `GET /lahtha/vendors/:id/audit` | Append-only audit trail (Rule 20). |

The acting principal is taken from the `x-actor-id` header; `x-correlation-id`
flows into every audit record. Persistence is in the `vendors` and
`vendor_audit_log` collections (see the `*-vendor-approval` migration).

> The vendor-approval states **are** the KYC state machine:
> `PENDING_OWNERSHIP_PROOF` ≈ `AWAITING_DOCUMENTS`, `PENDING_REVIEW` ≈ `UNDER_REVIEW`.

### Identity, OTP auth & sessions (Workstream 2 — IAM)

Passwordless vendor authentication with scoped, opaque sessions. Built with
hexagonal ports & adapters: pure use cases (`use-cases.ts`) depend on interfaces,
with Mongo/Entra adapters in production and in-memory adapters in tests.

**Scope model — LAHTHA login ≠ CLICK access.** A session gets only base scopes
(`lahtha:access`, `lahtha:kyc:write`) at login. The elevated scopes
(`click:access`, `click:wallet:write`, `settlement:write`) are granted **only when
both** hold: the vendor is `LAHTHA_APPROVED` (Rule 4) **and** the session has
passed MFA step-up.

```
register → request OTP → verify OTP (login, base scopes)
                                   └→ MFA step-up (Entra) ──┐
        vendor LAHTHA_APPROVED ─────────────────────────────┴→ elevated scopes
```

| Method & path | Purpose |
|---|---|
| `POST /iam/vendors` | Register a vendor identity (business name, email, phone). |
| `POST /iam/auth/otp/request` | Issue a one-time code (SMS/email). |
| `POST /iam/auth/otp/verify` | Verify the code → opaque session (HttpOnly cookie + bearer token). |
| `POST /iam/auth/mfa/step-up` | Verify a Microsoft Entra OIDC token → elevate the session. |
| `GET /iam/auth/session` | Current session (whoami). |
| `POST /iam/auth/logout` | Revoke the session. |
| `GET /iam/click/ping` | Demo route gated on `click:access` (proves the gate). |

**Security properties:** OTP codes are stored only as `HMAC(code, IAM_OTP_PEPPER)`,
verified in constant time with an attempt budget and a 5-minute expiry; session
tokens are random 256-bit values stored only as SHA-256 hashes, with a 12h sliding
/ 7d absolute lifetime and instant revocation. OTP challenges and sessions also
carry MongoDB TTL indexes. Auditable events (`VENDOR_OTP_REQUESTED`, `LOGIN_SUCCESS`,
`MFA_VERIFIED`, `LOGOUT`, `AUTHZ_DENIED`, …) are emitted via the injected Pino logger.

**MFA (Microsoft Entra ID):** `EntraMfaVerifier` validates an OIDC ID token's RS256
signature against the tenant JWKS (no extra deps — Node imports JWKs directly) plus
`iss`/`aud`/`exp`/`nbf`/`tid` claims. Configure via `ENTRA_TENANT_ID` /
`ENTRA_CLIENT_ID` (/ `ENTRA_ISSUER`); when unset, step-up fails closed. A live
tenant is required to exercise it end-to-end — unit tests use a fake verifier.

Collections: `vendor_identities`, `otp_challenges`, `sessions` (see the
`*-iam-identity-sessions` migration).

### RBAC — persons, principals, roles & permission checks (Workstream 2 — IAM)

Role-based access control per `docs/architecture/iam-rbac.md`. The role/permission
catalog is an in-code source of truth (`rbac/rbac-policy.ts`, validated at module
load); persons, users (principals) and role grants are persisted.

- **Persons & multi-principal users:** one human (`person`) can hold several
  principals (`customer` + `vendor` + `dealer`), unique per `(person, principalType)`.
  National ids are stored only as an HMAC hash, never raw.
- **Seed roles** (e.g. `vendor.owner`, `dealer.bidder`, `admin.compliance`) map to
  `{domain}.{resource}.{action}` permissions. A role is grantable only to its
  matching principal type.
- **Effective permissions** are the union over granted roles — but a non-active user
  (pending KYC / suspended / revoked) has **none**.
- **User status state machine:** `pending_kyc → active → suspended ⇄ active`, and
  `→ revoked` (terminal).
- **`requirePermission(service, perm)`** middleware resolves the actor (Phase-1:
  `x-user-id` header), and records every decision (allow/deny) in `access_audit`
  with the correlation id.

| Method & path | Purpose |
|---|---|
| `GET /iam/roles` | Seed role/permission catalog. |
| `POST /iam/persons` | Create a person. |
| `POST /iam/persons/:id/users` | Create a principal (user) for a person. |
| `GET /iam/users/:id` | User + roles + effective permissions. |
| `POST /iam/users/:id/roles` | Grant a role (idempotent). |
| `DELETE /iam/users/:id/roles/:roleId` | Revoke a role. |
| `POST /iam/users/:id/status` | Apply a status transition (`ACTIVATE`/`SUSPEND`/`REINSTATE`/`REVOKE`). |
| `GET /iam/access-audit` | Audit log — gated on `platform.audit.read`. |
| `GET /iam/rbac/ping` | Demo route gated on `platform.read_all`. |

Collections: `persons`, `users`, `user_roles`, `access_audit` (see the `*-iam-rbac`
migration). Roles/permissions are not persisted (in-code catalog).

> The management endpoints above are open in this slice; they will be gated by
> `requirePermission` once sessions carry a `user_id` (auth↔user bridge).

## Testing

```bash
npm test          # vitest one-shot
npm run test:watch
```

The test suite does not require a running MongoDB instance. Bootstrap and
correlation middleware are covered, and the vendor-approval domain is tested
end-to-end (pure state machine, service, and HTTP routes) against in-memory
repositories that implement the same persistence ports as the Mongo-backed ones.

## Observability (Workstream 1 baseline)

- Structured JSON logs via `pino`.
- Every request emits one log line; `correlationId` is included.
- Correlation IDs accepted from the `x-correlation-id` header or generated as UUIDv4.
- Prometheus metrics + OpenTelemetry tracing are out of scope for Workstream 1; tracked for a follow-up.

## Layout

```
lahtha-click/
├── src/
│   ├── server.ts           # bootstrap: connect DB, start HTTP, graceful shutdown
│   ├── app.ts              # Express app factory
│   ├── config/             # zod-validated env loader
│   ├── lib/                # cross-cutting (db, logger)
│   ├── middleware/         # correlation id, error handler
│   ├── routes/             # health + readiness
│   └── domains/
│       └── lahtha/vendor/  # vendor approval: state machine, service, repos, routes
├── migrations/             # migrate-mongo migrations (CommonJS)
└── tests/                  # vitest
```

## Workstream 1 acceptance criteria
- [x] Repo skeleton (TS strict, ES2022, NodeNext)
- [x] MongoDB connection wired (Mongoose)
- [x] migrate-mongo configured with baseline migration
- [x] Health + readiness endpoints
- [x] Structured logging + correlation IDs
- [x] CI pipeline runs build, tests, and migrations against a real MongoDB
