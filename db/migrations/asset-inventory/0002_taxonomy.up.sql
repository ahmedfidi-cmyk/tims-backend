-- Asset taxonomy: reference data that changes rarely.
-- See docs/architecture/asset-inventory-schema.md for index rationale.

CREATE TABLE manufacturers (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_manufacturers_name UNIQUE (name)
);

-- ASSUMPTION: categories are a flat list (no parent/child hierarchy).
-- The brief didn't ask for nested categories; add a self-referencing
-- parent_category_id later if "Networking > Switches > Core" trees are needed.
CREATE TABLE categories (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_categories_name UNIQUE (name)
);

CREATE TABLE hardware_models (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id UUID        NOT NULL REFERENCES manufacturers(id),
    category_id     UUID        NOT NULL REFERENCES categories(id),
    model_number    TEXT        NOT NULL,
    model_name      TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Model numbers are only guaranteed unique within one manufacturer's catalog.
    CONSTRAINT uq_hardware_models_manufacturer_model_number UNIQUE (manufacturer_id, model_number),
    -- Lets `assets` carry a denormalized manufacturer_id that a composite FK
    -- can verify against this row's real manufacturer (see 0004_assets.up.sql).
    CONSTRAINT uq_hardware_models_id_manufacturer UNIQUE (id, manufacturer_id)
);

-- Serves "browse/report hardware models by category" and the assets -> hardware_models
-- join when a query filters by category.
CREATE INDEX ix_hardware_models_category_id ON hardware_models (category_id);
