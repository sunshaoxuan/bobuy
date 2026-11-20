-- Conflict snapshot only; no business records or automatic imports.
ALTER TABLE bb_category_path_import ADD COLUMN preview_state text;
