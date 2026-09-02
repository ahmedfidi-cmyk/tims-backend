-- Asset Inventory schema (docs/architecture/asset-inventory-schema.md)
-- Enables gen_random_uuid() for server-side UUID defaults.
-- Postgres 15 has no built-in UUIDv7 generator (added upstream only in PG18);
-- pgcrypto's gen_random_uuid() (UUIDv4) is the in-core fallback used as the
-- column DEFAULT. See the design doc for the recommended app-side UUIDv7 path.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
