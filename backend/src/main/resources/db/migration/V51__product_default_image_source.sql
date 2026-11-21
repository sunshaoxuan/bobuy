ALTER TABLE bb_product ADD COLUMN IF NOT EXISTS default_image_source_url varchar(2048);
ALTER TABLE bb_product_catalog_recovery ADD COLUMN IF NOT EXISTS default_image_source_url varchar(2048);
