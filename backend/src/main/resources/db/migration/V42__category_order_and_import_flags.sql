-- Legacy ranks have no provenance. Preserve them, including any admin choices.
-- ADD's initial true value applies only on first installation; later inserts default false.
ALTER TABLE bb_category_tree_node ADD COLUMN IF NOT EXISTS explicit_order boolean NOT NULL DEFAULT true;
ALTER TABLE bb_category_tree_node ALTER COLUMN explicit_order SET DEFAULT false;
ALTER TABLE bb_category_path_import_row ADD COLUMN IF NOT EXISTS flag text;
ALTER TABLE bb_product ADD COLUMN IF NOT EXISTS category_import_flag text;
