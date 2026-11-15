-- Additive provenance only. Existing product/category data remains intact.
ALTER TABLE bb_category_path_import_row ADD COLUMN IF NOT EXISTS source_tier text;
ALTER TABLE bb_product ADD COLUMN IF NOT EXISTS category_path_source text;
