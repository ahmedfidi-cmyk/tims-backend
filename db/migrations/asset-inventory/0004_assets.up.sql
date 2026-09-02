-- Physical assets: the actual inventory.

CREATE TABLE assets (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tag         TEXT        NOT NULL,
    serial_number     TEXT        NOT NULL,
    po_number         TEXT,
    hardware_model_id UUID        NOT NULL,
    -- Denormalized from hardware_models.manufacturer_id. Kept consistent by
    -- the composite FK below (never set independently by the application).
    -- This lets "serial number unique per manufacturer" be a plain two-column
    -- UNIQUE constraint instead of a cross-table constraint, which Postgres
    -- cannot express directly.
    manufacturer_id   UUID        NOT NULL,
    state             TEXT        NOT NULL DEFAULT 'IN_STOCK' REFERENCES asset_lifecycle_states(code),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_assets_asset_tag UNIQUE (asset_tag),
    CONSTRAINT uq_assets_manufacturer_serial UNIQUE (manufacturer_id, serial_number),
    CONSTRAINT fk_assets_hardware_model_manufacturer
        FOREIGN KEY (hardware_model_id, manufacturer_id)
        REFERENCES hardware_models (id, manufacturer_id)
);

-- Serves: (a) "all assets of hardware model X" (leftmost prefix also covers
-- hardware_model_id-only lookups), (b) the composite FK's own lookup cost on
-- insert/update, which Postgres does NOT index automatically for you.
CREATE INDEX ix_assets_hardware_model_manufacturer ON assets (hardware_model_id, manufacturer_id);

-- Serves "scan a serial number with no manufacturer context" (e.g. a
-- handheld scanner reading a label). uq_assets_manufacturer_serial above
-- can't serve this alone because manufacturer_id is its leading column.
CREATE INDEX ix_assets_serial_number ON assets (serial_number);

-- Serves dashboard/report filters like "list all IN_STOCK assets" or
-- "count assets by state". Low cardinality (8 values) but the distribution
-- is expected to be skewed (few DECOMMISSIONED/DISPOSED vs many ASSIGNED),
-- so an equality-filter index still pays off.
CREATE INDEX ix_assets_state ON assets (state);

-- Serves "find every asset on PO #12345" (a PO commonly covers a bulk
-- purchase of many assets, so this is a plain index, not unique). Partial to
-- skip rows where the PO was never recorded.
CREATE INDEX ix_assets_po_number ON assets (po_number) WHERE po_number IS NOT NULL;

-- --- Lifecycle transition enforcement -------------------------------------
-- A plain CHECK constraint cannot compare a row's old and new values, so the
-- from/to validation lives in a trigger that consults asset_lifecycle_transitions
-- (0003_lifecycle_states.up.sql). This is the DB-level guard the brief asked
-- for; it fires on every UPDATE regardless of which client makes the change.
CREATE OR REPLACE FUNCTION enforce_asset_state_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.state IS DISTINCT FROM OLD.state THEN
        IF NOT EXISTS (
            SELECT 1 FROM asset_lifecycle_transitions
            WHERE from_state = OLD.state AND to_state = NEW.state
        ) THEN
            RAISE EXCEPTION 'Invalid asset lifecycle transition: % -> %', OLD.state, NEW.state
                USING ERRCODE = '23514'; -- check_violation
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assets_enforce_state_transition
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION enforce_asset_state_transition();
