-- Additive and nullable: existing product/recommendation content is unchanged.
ALTER TABLE bb_product ADD COLUMN catalog_data jsonb;
