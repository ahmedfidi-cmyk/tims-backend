DROP TRIGGER IF EXISTS trg_assets_enforce_state_transition ON assets;
DROP FUNCTION IF EXISTS enforce_asset_state_transition();
DROP TABLE IF EXISTS assets;
