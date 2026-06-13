# ADR-0005 — Link the Vendor Identity and the Vendor-Approval Record

| | |
|---|---|
| **Status** | Accepted (implemented) |
| **Date** | 2026-06-11 |
| **Decision owners** | Engineering + Owner |
| **Relates to** | [`iam-rbac.md`](../architecture/iam-rbac.md), the vendor-approval domain, the auth↔user bridge |

## Context

Two unrelated "vendor" concepts existed:

1. **IAM vendor identity** — `POST /iam/vendors` (web signup) creates a `vendor_identities`
   row + an RBAC `vendor` principal (`pending_kyc`), and the session binds to its `userId`.
2. **Vendor-approval record** — a separate entity (own id) created via `POST /lahtha/vendors`,
   driven by the approval state machine (`PENDING_OWNERSHIP_PROOF → PENDING_REVIEW →
   LAHTHA_APPROVED / REJECTED`).

They were never linked. Consequences: the admin review queue (which lists approval records)
did **not** reflect real signups, and approving a vendor did **not** let them in (the RBAC
user stayed `pending_kyc` with no role, so the CLICK gate and `device.list` never opened).

## Decision

Two owner decisions, both implemented:

### 1. Unify at signup, shared id
When `POST /iam/vendors` registers a **vendor** principal, it now also creates the linked
**vendor-approval record using the same id** (the identity's `vendorId`) and stamps the
`userId` on it. The approval record's `name`/`contactEmail` come from the signup
`businessName`/`email`. Result: identities and approval records are **1:1**, and the admin
queue reflects actual signups.

`POST /lahtha/vendors` remains for tests/back-compat; records created that way have
`userId = null` (unlinked) and simply don't trigger account activation on approval.

### 2. Approval activates the account
On `LAHTHA_APPROVED`, the vendor-approval service calls an injected activation port that, for
the linked `userId`, **activates the RBAC user** (`pending_kyc → active`, idempotent) and
**grants `vendor.owner`** (idempotent). One admin click both approves the vendor and lets them
operate. `vendor.warehouse_manager` (IMEI registration) remains a separate grant on the roles
page. Activation is best-effort: a failure is logged but does not roll back the approval (the
admin can finish it from the roles page).

## Design — two thin cross-domain ports

The domains stay decoupled behind interfaces; the composition root wires concrete adapters.

- **IAM → vendor-approval** (`VendorApprovalProvisioner`): `registerVendorIdentity` calls it
  (vendors only) to create the linked approval record with the shared `vendorId` + `userId`.
- **vendor-approval → RBAC** (`VendorActivationPort`): `approve` calls it with the record's
  `userId` to activate + grant the default role.

`VendorApprovalService.register` now accepts an optional `vendorId`/`userId` (shared-id path);
the `Vendor` entity gains a nullable `userId`.

### Wiring (no cycle — linear order in `app.ts`)
```
rbac            = createRbacService()                       // depends on nothing
vendorApproval  = VendorApprovalService(repos, RbacVendorActivation(rbac))
iam             = createIamModule({ rbac, approvalProvisioner: …(vendorApproval) })
mount /iam (iam.router), /lahtha (vendorApproval, iam.authz), inventory, checkout
```
`createIamModule` now accepts the externally-built `rbac` and the approval provisioner, instead
of building its own RBAC service.

## Consequences

### Positive
- The admin queue reflects real signups; approval is one click and actually onboards the vendor.
- Domains remain decoupled (ports + adapters); reuses the existing approval state machine, RBAC
  status machine, and grant logic.

### Negative / trade-offs
- Two cross-domain ports + a composition-root refactor (RBAC built once and shared).
- Activation is best-effort (logged on failure), not a distributed transaction — acceptable for
  single-node Phase 1; a vendor could be `LAHTHA_APPROVED` yet briefly not `active` if RBAC
  errors. The roles page is the manual fallback.
- Legacy `POST /lahtha/vendors` records are unlinked (`userId = null`) and don't auto-activate.

### Data
- `vendors` gains a nullable `userId` (schemaless add; no migration needed). Existing rows read
  back as `userId = null`.

## Test plan
- IAM: vendor signup creates a linked approval record (shared `vendorId` + `userId`); a customer
  signup does not.
- Vendor service: `approve` invokes the activation port with the record's `userId`; a `userId =
  null` record approves without activation; activation failure is swallowed (approval still 200).
- End-to-end (in-memory): signup → approval record `PENDING_OWNERSHIP_PROOF` → submit proof →
  approve → RBAC user is `active` and holds `vendor.owner`.
