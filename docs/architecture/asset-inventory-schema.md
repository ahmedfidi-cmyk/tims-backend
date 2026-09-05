# Asset Inventory Schema

> A separate track from [`imei-inventory-schema.md`](./imei-inventory-schema.md): that doc covers
> LAHTHA's phone/IMEI marketplace inventory. This one covers a generic **physical IT asset**
> inventory (laptops, network gear, etc.) — asset tags, hardware taxonomy, lifecycle state, chain
> of custody, and an immutable audit log.

**Scale** [FILL IN — not specified]: assumed **tens of thousands of assets** (10⁴–10⁵ rows in
`assets`), audit log growing an order of magnitude larger over a few years, moderate write rate
(nothing like the auction system's bid volume elsewhere in this repo). This assumption drives the
indexing choices below — plain B-tree/partial indexes, no partitioning yet. If this is actually
meant for hundreds of thousands to millions of assets, revisit two things: (1) partition
`asset_audit_log` by `occurred_at` (monthly range partitions) once it passes a few million rows,
and (2) add `CREATE INDEX CONCURRENTLY` migration variants per this repo's own [migration
discipline](./README.md#migration-discipline) so index adds don't lock a hot table.

**Stack** [FILL IN — not specified]: **PostgreSQL 15**, per your requirements (UUID PKs, JSONB,
DB-level constraints). Migrations are plain versioned SQL `up`/`down` file pairs rather than a
specific runner's format — this repo's existing migration tooling (`migrate-mongo`) is
MongoDB-only, and the Alembic tooling the architecture docs call for needs Python, which isn't
present in this Node/TS codebase. Plain SQL works as-is with `node-pg-migrate`, `dbmate`,
`golang-migrate`, or Flyway with only filename tweaks. Swap this note out once you've picked one.

Files: [`../../db/migrations/asset-inventory/`](../../db/migrations/asset-inventory/), applied in
numeric order. All DDL in this doc has been applied against a real PostgreSQL instance (up, then
down, round-trip) to confirm it's valid — see the migration files' inline comments for what each
constraint/index is for.

## Tables

```
manufacturers ──┐
                ├──< hardware_models >── categories
                │         │
                │         │ (id, manufacturer_id) composite FK
                │         ▼
                └──< assets >──< asset_mac_addresses
                       │  │
                       │  └──< asset_custody_records
                       │
                       └── state ─FK─> asset_lifecycle_states
                                        ▲
                            asset_lifecycle_transitions (from_state, to_state)

asset_audit_log   (polymorphic: entity_type + entity_id, no FK — logs any of the above)
```

### 1. Asset taxonomy — `manufacturers`, `categories`, `hardware_models`

Reference data. `hardware_models` carries both a manufacturer and category FK, and is unique on
`(manufacturer_id, model_number)` since model numbers are only guaranteed unique within one
vendor's own catalog, not globally.

`hardware_models` also carries `UNIQUE (id, manufacturer_id)` — this looks redundant next to the
primary key, but it's what lets `assets` verify its denormalized `manufacturer_id` via a composite
foreign key (see below). It's not used for any query on its own.

### 2. Physical assets — `assets`

One row per physical unit. `manufacturer_id` here is a **denormalized** copy of
`hardware_models.manufacturer_id`, kept honest by:

```sql
CONSTRAINT fk_assets_hardware_model_manufacturer
    FOREIGN KEY (hardware_model_id, manufacturer_id)
    REFERENCES hardware_models (id, manufacturer_id)
```

Postgres has no direct way to express "serial number unique per manufacturer" when manufacturer is
two joins away (`assets → hardware_models → manufacturers`) — a plain `UNIQUE` constraint only sees
columns on the same table. Denormalizing `manufacturer_id` onto `assets`, with the composite FK
enforcing it can never disagree with the model's real manufacturer, turns it into an ordinary
`UNIQUE (manufacturer_id, serial_number)`. I verified this by hand: inserting an asset with a
`hardware_model_id`/`manufacturer_id` pair that doesn't match `hardware_models` is rejected by the
FK, not silently accepted.

### 3. Lifecycle state — `asset_lifecycle_states`, `asset_lifecycle_transitions` + trigger

A plain `CHECK` constraint can't express "reject `DISPOSED → ASSIGNED`" because a `CHECK` has no
way to see a row's *previous* value — it only ever sees the one row being written. The DB-level
equivalent is:

- `asset_lifecycle_states` — the 8 valid state codes, referenced by `assets.state`.
- `asset_lifecycle_transitions` — every allowed `(from_state, to_state)` edge.
- A `BEFORE UPDATE` trigger on `assets` that raises `check_violation` (SQLSTATE `23514`) when
  `OLD.state → NEW.state` isn't in that edge table.

`DISPOSED` has zero outgoing rows, so it's a true terminal state — confirmed by testing that
`DISPOSED → ASSIGNED` is rejected end to end (insert an asset, drive it through
`IN_STOCK → DECOMMISSIONED → DISPOSED`, then attempt `→ ASSIGNED`).

**Flagged assumption:** the transition matrix itself (which states can reach which) is my
best guess at your business rules, not something you specified — e.g. I allowed `LOST → IN_STOCK`
to model a recovered asset. Review the `INSERT`s in
[`0003_lifecycle_states.up.sql`](../../db/migrations/asset-inventory/0003_lifecycle_states.up.sql)
and edit the edge list to match reality; it's data, not code, so changing it doesn't need a new
migration once the tables exist (though for a tracked change you'd still want one).

### 4. MAC addresses — `asset_mac_addresses`

**Flagged assumption:** modeled one-to-many via a child table (an asset can have 0, 1, or many
MACs — e.g. a server with multiple NICs), since the brief says "MAC address(es)". The alternative
— a `MACADDR[]` array column directly on `assets` — was rejected because it can't carry a per-MAC
`UNIQUE` constraint or its own audit trail, and querying "which asset owns this MAC" needs a GIN
index on the array vs. a plain B-tree here.

**Flagged assumption:** `mac_address` is globally unique across the whole inventory. Real
IEEE-assigned MACs are unique by construction, but this would need loosening (e.g., unique only
among non-`DISPOSED` assets) if virtualized/cloned MACs or address reuse after disposal are
actually in scope.

### 5. Chain of custody — `asset_custody_records`

One row per handover: who received it, who handed it over, when, expected/actual return, condition
notes at each end, and a **reference only** to the handover slip (`handover_slip_ref`, e.g. an S3
key or URL) — the file itself is not stored in Postgres, per the brief.

**Flagged assumption, now confirmed permanent:** `assigned_to_id`/`assigned_by_id` are bare `UUID`
columns with **no FK**. When this doc was first written, that was a forward reference pending
Phase 2 (auth/OIDC + RBAC). Phase 2 turned out to build on this repo's *existing* IAM/RBAC system
(`lahtha-click/src/domains/iam/`, see `docs/architecture/iam-rbac.md`), which is **MongoDB-resident**
(`persons`/`users`/`user_roles` collections), not Postgres. A Postgres `FOREIGN KEY` cannot
reference a row in a different database engine — so this is no longer "add the FK once the table
exists," it's a permanent limitation of the polyglot-persistence split between this Postgres asset
schema and the app's Mongo-backed identity store. Consistency of `assigned_to_id`/`assigned_by_id`
against real users is therefore an **application-level** concern: whatever service writes a custody
record must look the `userId` up via the IAM service first. The denormalized `*_label` columns
(name/email captured at handover time) still carry their original purpose — the custody history
stays readable even if that person is later removed from IAM — and matter more now that there's no
DB-level guarantee backing the ID at all.

### 6. Audit log — `asset_audit_log`

Append-only. `entity_type` + `entity_id` is a polymorphic reference (it logs changes to assets,
hardware models, custody records, anything) — **flagged assumption:** `entity_id` deliberately has
no FK, since there's no single table it always points at. That's the standard trade-off for a
cross-entity audit log: it gives up referential integrity on that column in exchange for one audit
table instead of one per entity type.

Immutability is enforced with `REVOKE UPDATE, DELETE, TRUNCATE ON asset_audit_log FROM PUBLIC`. I
verified this actually blocks writes: created a throwaway non-owner role, granted it only
`SELECT, INSERT`, and confirmed `UPDATE`/`DELETE` both fail with `permission denied` while `SELECT`
and `INSERT` succeed. Two caveats worth knowing:

- **The table owner always bypasses grants.** Whatever role runs these migrations owns the table
  and can still write/delete freely. The guarantee only holds for whatever role your application
  connects as, and only if that role is *not* the owner.
- **There's still no real "application role" to grant.** Phase 2's identity/RBAC turned out to be
  Mongo-resident (see the custody-record note above), so it doesn't create a Postgres role either.
  The actual `GRANT SELECT, INSERT ON asset_audit_log TO <role>` stays a commented template in
  [`0007_audit_log.up.sql`](../../db/migrations/asset-inventory/0007_audit_log.up.sql) until
  whatever Postgres connection pool this schema eventually gets wired to has a named runtime role.

## Index rationale (all of them)

| Index | Query pattern it serves |
|---|---|
| `uq_manufacturers_name`, `uq_categories_name` | Prevent/duplicate-check creation; name lookups & autocomplete. |
| `uq_hardware_models_manufacturer_model_number` | "Does this manufacturer already have this model number?" |
| `ix_hardware_models_category_id` | Browse/report hardware models by category. |
| `uq_assets_asset_tag` | Primary human-facing lookup — scan an asset tag, get one row. |
| `uq_assets_manufacturer_serial` | "Serial unique per manufacturer" constraint; also serves manufacturer-scoped serial lookups and (leftmost prefix) "assets by manufacturer". |
| `ix_assets_serial_number` | Look up an asset by serial alone, with no manufacturer context (e.g. a scanner that only reads the serial label) — the composite unique index above can't serve this since `manufacturer_id` is its leading column. |
| `ix_assets_hardware_model_manufacturer` | "All assets of hardware model X"; also backs the composite FK's own lookup cost (Postgres never auto-indexes FK columns, only PK/unique columns). |
| `ix_assets_state` | Dashboards/reports filtering by lifecycle state (`IN_STOCK` count, `ASSIGNED` listing, etc.) — worth it even at 8 distinct values because the distribution is expected to be skewed. |
| `ix_assets_po_number` (partial, `WHERE po_number IS NOT NULL`) | "Which assets were on PO #12345" — a PO commonly covers a bulk purchase of many assets, so this is non-unique; partial because many rows won't have one. |
| `uq_asset_mac_addresses_mac` | Global MAC uniqueness (see assumption above). |
| `ix_asset_mac_addresses_asset_id` | "All MAC addresses for this asset" — an asset detail view. |
| `ix_custody_asset_id_handover_date` (`asset_id, handover_date DESC`) | The dominant query: custody history for one asset, most recent first. |
| `ix_custody_open_by_assignee` (partial, `WHERE return_date IS NULL`) | "What does person X currently hold" — partial so the index only covers the (small) set of open handovers, not the full history. |
| `ix_audit_entity` (`entity_type, entity_id, occurred_at DESC`) | The dominant query: audit trail for one specific record, newest first. |
| `ix_audit_actor` (`actor_id, occurred_at DESC`) | "Everything actor X has done" — security investigations. |
| `ix_audit_diff_gin` (GIN on `diff`) | Ad-hoc containment queries against the JSONB payload, e.g. "find every change where `state` moved to `DISPOSED`". Optional — it costs write overhead on every insert; drop it if that search pattern isn't actually needed. |

## UUID primary keys and UUIDv7

You asked to be told directly: **Postgres 15 has no built-in UUIDv7 generator.** Native `uuidv7()`
only shipped upstream in **Postgres 18** (2025). On 15 your options are:

1. **`pgcrypto`'s `gen_random_uuid()`** (UUIDv4, fully random) — built into core since PG13,
   no extra extension beyond `CREATE EXTENSION pgcrypto`. This is what every table in this schema
   defaults `id` to. Simple, always available (works on RDS/Cloud SQL/Azure/Supabase without
   special permission), but UUIDv4 has no time-ordering — new rows land at random points in a
   B-tree index, which hurts insert locality and index bloat at high write volume.
2. **The community `pg_uuidv7` extension** — adds a `uuid_generate_v7()` function to 15/16/17.
   Gives time-ordered UUIDs at the DB layer, but it's a third-party extension: it has to be
   installed on the server (`CREATE EXTENSION` alone isn't enough if the `.so` isn't already
   present), which most managed Postgres providers won't let you do without an allowlist request.
3. **Generate UUIDv7 in the application** (e.g. Node's `uuid` package ≥ v9, or the `uuidv7`
   package) and pass it explicitly on `INSERT`, leaving the column's `DEFAULT gen_random_uuid()`
   as a fallback for anything that doesn't set it. Given this repo's stack is Node/TS, this is the
   path I'd actually recommend if insert locality starts to matter at your real scale — no server
   install required, and it composes with the `DEFAULT` already in these migrations.

I left every table on `DEFAULT gen_random_uuid()` (option 1) so the schema works out of the box on
any Postgres 15 instance with zero extra permissions. Switching to option 3 later is a
non-breaking, code-only change — the column stays `UUID`, only where the value comes from changes.

## Assumptions flagged in full (rather than asked)

1. **Categories are flat** — no parent/child hierarchy. Add a self-referencing `parent_category_id`
   later if nested categories (e.g. "Networking → Switches → Core") turn out to be needed.
2. **No soft-delete column on `assets`.** The lifecycle state machine already models this: an
   asset winds down to `DISPOSED` (terminal) rather than disappearing, so a hard `DELETE` on
   `assets` should essentially never happen in normal operation. I didn't add a `deleted_at`
   column on top of that.
3. **MAC addresses are one-to-many**, via a child table, not a single column or an array — see
   §4 above.
4. **MAC addresses are globally unique** across the whole inventory (real IEEE MACs are; virtual
   or reused MACs would need a different constraint).
5. **The lifecycle transition matrix is a guess.** The 8 states are exactly what you specified;
   which transitions between them are legal is not — I picked a reasonable set and flagged it
   loudly in the migration file itself.
6. **`assigned_to_id`/`assigned_by_id`/`actor_id` have no FK to a users table, permanently** — not a
   forward reference anymore. Phase 2 built on this repo's existing IAM/RBAC (Mongo-resident, see
   `docs/architecture/iam-rbac.md`), so there is no Postgres `users` table for these columns to
   reference; a cross-database FK isn't something Postgres can express. They're paired with
   denormalized label/email snapshots so history stays readable regardless, and consistency has to
   be enforced at the application layer instead of the database layer.
7. **`asset_audit_log.entity_id` has no FK** — it's polymorphic by design (see §6 above).
8. **Migration format is plain versioned SQL**, not a specific tool's dialect — see the Stack note
   at the top.
9. **Scale is assumed to be 10⁴–10⁵ assets** — see the Scale note at the top.

## Out of scope (per your instruction to stop after the schema)

No ORM models, no endpoints, no seed/fixture data beyond the lifecycle state/transition rows that
the transition-enforcement trigger itself depends on (those are schema configuration, not sample
business data — without them the `CHECK`-equivalent trigger has nothing to validate against).
