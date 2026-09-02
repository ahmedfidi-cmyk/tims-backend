-- Immutable audit log: append-only, no UPDATE/DELETE for the application.
--
-- ASSUMPTION: entity_id/entity_type are a polymorphic reference (this table
-- logs changes to assets, hardware_models, custody records, etc.), so
-- entity_id deliberately has no FK -- there's no single table it always
-- points at. This trades referential integrity for the table's generality,
-- which is the standard shape for a cross-entity audit log.

CREATE TABLE asset_audit_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     UUID,
    actor_email  TEXT        NOT NULL,
    action       TEXT        NOT NULL,
    entity_type  TEXT        NOT NULL,
    entity_id    UUID        NOT NULL,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address   INET,
    diff         JSONB,
    CONSTRAINT chk_audit_diff_is_object CHECK (diff IS NULL OR jsonb_typeof(diff) = 'object')
);

-- Serves the dominant query: "audit trail for this specific record", most
-- recent first (a compliance/investigation view on one asset or model).
CREATE INDEX ix_audit_entity ON asset_audit_log (entity_type, entity_id, occurred_at DESC);

-- Serves "everything actor X has done" (security investigations).
CREATE INDEX ix_audit_actor ON asset_audit_log (actor_id, occurred_at DESC);

-- Serves ad-hoc containment queries against the diff payload, e.g. "find
-- every change where state moved to DISPOSED". Optional: it adds write
-- overhead on every insert, so drop it if that search pattern isn't needed.
CREATE INDEX ix_audit_diff_gin ON asset_audit_log USING GIN (diff);

-- Immutability at the DB level. By default a freshly created table already
-- grants PUBLIC nothing, so this is defense-in-depth against a later
-- blanket `GRANT ALL ... TO PUBLIC` elsewhere, and it documents the intent.
-- The actual guarantee requires the application's runtime role to be
-- granted INSERT + SELECT only (never UPDATE/DELETE, and never made the
-- table owner, since owners bypass grants). That role doesn't exist in this
-- repo yet -- Phase 2 introduces IAM/RBAC -- so it's left as a template:
--   GRANT SELECT, INSERT ON asset_audit_log TO app_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON asset_audit_log FROM PUBLIC;
