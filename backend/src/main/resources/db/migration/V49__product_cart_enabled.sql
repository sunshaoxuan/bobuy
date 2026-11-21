ALTER TABLE bb_product ADD COLUMN IF NOT EXISTS cart_enabled boolean NOT NULL DEFAULT true;
