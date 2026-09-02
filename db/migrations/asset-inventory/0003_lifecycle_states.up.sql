-- Lifecycle state lookup + explicit transition graph.
--
-- Postgres CHECK constraints cannot see a row's previous value (no OLD/NEW
-- inside a CHECK), so "reject DISPOSED -> ASSIGNED" cannot be expressed as a
-- plain column CHECK. The DB-level equivalent is: a lookup table of valid
-- states, a table of valid (from_state, to_state) edges, and a BEFORE UPDATE
-- trigger (added in 0004_assets.up.sql once the assets table exists) that
-- rejects any transition not present in the edge table.
--
-- Populating these two tables is schema configuration required for the
-- constraint to function at all, not sample/business seed data, so it's
-- included here rather than deferred.

CREATE TABLE asset_lifecycle_states (
    code TEXT PRIMARY KEY
);

INSERT INTO asset_lifecycle_states (code) VALUES
    ('IN_STOCK'),
    ('ASSIGNED'),
    ('IN_TRANSIT'),
    ('UNDER_MAINTENANCE'),
    ('RESERVED'),
    ('DECOMMISSIONED'),
    ('DISPOSED'),
    ('LOST');

CREATE TABLE asset_lifecycle_transitions (
    from_state TEXT NOT NULL REFERENCES asset_lifecycle_states(code),
    to_state   TEXT NOT NULL REFERENCES asset_lifecycle_states(code),
    PRIMARY KEY (from_state, to_state)
);

-- ASSUMPTION: this transition matrix is my best guess at the intended
-- business rules, not something you specified. Review/edit these rows to
-- match real policy. Notably:
--   - DISPOSED has no outgoing rows at all -> terminal, matching the
--     DISPOSED -> ASSIGNED example you gave.
--   - LOST -> IN_STOCK models "asset was later found/recovered"; drop that
--     row if a lost asset should never re-enter active stock.
INSERT INTO asset_lifecycle_transitions (from_state, to_state) VALUES
    ('IN_STOCK', 'ASSIGNED'),
    ('IN_STOCK', 'RESERVED'),
    ('IN_STOCK', 'IN_TRANSIT'),
    ('IN_STOCK', 'UNDER_MAINTENANCE'),
    ('IN_STOCK', 'DECOMMISSIONED'),
    ('IN_STOCK', 'LOST'),
    ('RESERVED', 'ASSIGNED'),
    ('RESERVED', 'IN_STOCK'),
    ('RESERVED', 'IN_TRANSIT'),
    ('ASSIGNED', 'IN_STOCK'),
    ('ASSIGNED', 'IN_TRANSIT'),
    ('ASSIGNED', 'UNDER_MAINTENANCE'),
    ('ASSIGNED', 'LOST'),
    ('ASSIGNED', 'DECOMMISSIONED'),
    ('IN_TRANSIT', 'IN_STOCK'),
    ('IN_TRANSIT', 'ASSIGNED'),
    ('IN_TRANSIT', 'LOST'),
    ('UNDER_MAINTENANCE', 'IN_STOCK'),
    ('UNDER_MAINTENANCE', 'ASSIGNED'),
    ('UNDER_MAINTENANCE', 'DECOMMISSIONED'),
    ('UNDER_MAINTENANCE', 'LOST'),
    ('DECOMMISSIONED', 'DISPOSED'),
    ('LOST', 'IN_STOCK'),
    ('LOST', 'DECOMMISSIONED');
