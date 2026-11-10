-- Additive only. Keep these sidecars on application rollback; never drop recovery data.
-- Legacy binaries continue reading the unchanged bb_order_header.lines JSON shape.
ALTER TABLE bb_order_header ADD COLUMN product_identities jsonb;
CREATE TABLE bb_product_catalog_recovery (
 id varchar(36) PRIMARY KEY,
 merchant_id bigint NOT NULL REFERENCES bb_user(id),
 product_id varchar(255) NOT NULL REFERENCES bb_product(id),
 version_after bigint NOT NULL,
 created_at timestamp with time zone NOT NULL,
 restored_from_id varchar(36),
 original jsonb NOT NULL
);
CREATE INDEX ix_bb_catalog_recovery_product_version ON bb_product_catalog_recovery(product_id, merchant_id, version_after DESC);
