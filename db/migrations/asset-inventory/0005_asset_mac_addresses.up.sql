-- MAC addresses: modeled one-to-many (a child table), since the brief says
-- "MAC address(es)" and real assets (e.g. servers, multi-NIC laptops) can
-- carry more than one. See the design doc for the alternative considered
-- (an array column) and why a child table won here.

CREATE TABLE asset_mac_addresses (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id    UUID        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    mac_address MACADDR     NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- ASSUMPTION: MAC addresses are globally unique across the whole
    -- inventory. Real IEEE-assigned MACs are, but this would need loosening
    -- (e.g. unique only among non-DISPOSED assets) if virtualized/cloned or
    -- reused-after-disposal MACs are in scope.
    CONSTRAINT uq_asset_mac_addresses_mac UNIQUE (mac_address)
);

-- Serves "list all MAC addresses of this asset" (the asset detail view).
CREATE INDEX ix_asset_mac_addresses_asset_id ON asset_mac_addresses (asset_id);
