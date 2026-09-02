-- Chain of custody: one row per handover.
--
-- ASSUMPTION: assigned_to/assigned_by reference a person, but this repo has
-- no users/identity table yet (Phase 2 brings auth/OIDC + RBAC). The *_id
-- columns are left as bare UUIDs with no FK for now -- a forward reference
-- to whatever identity table Phase 2 introduces -- and are paired with a
-- denormalized *_label snapshot (name/email at handover time) so history
-- stays legible even if that person later leaves the identity system.
-- Add the FK once the identity table exists.

CREATE TABLE asset_custody_records (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id               UUID        NOT NULL REFERENCES assets(id),
    assigned_to_id         UUID,
    assigned_to_label      TEXT        NOT NULL,
    assigned_by_id         UUID,
    assigned_by_label      TEXT        NOT NULL,
    handover_date          TIMESTAMPTZ NOT NULL,
    expected_return_date   TIMESTAMPTZ,
    return_date            TIMESTAMPTZ,
    condition_notes        TEXT,
    return_condition_notes TEXT,
    -- Reference/path only (e.g. an S3 key or URL) -- the file itself is not
    -- stored in Postgres, per the brief.
    handover_slip_ref      TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_custody_return_after_handover
        CHECK (return_date IS NULL OR return_date >= handover_date)
);

-- Serves the dominant query: "custody history for this asset, most recent
-- first" (an asset's detail page).
CREATE INDEX ix_custody_asset_id_handover_date ON asset_custody_records (asset_id, handover_date DESC);

-- Serves "what does person X currently hold" (open assignments only).
-- Partial so the index only covers the (small) set of un-returned handovers
-- instead of the full history table.
CREATE INDEX ix_custody_open_by_assignee ON asset_custody_records (assigned_to_id) WHERE return_date IS NULL;
