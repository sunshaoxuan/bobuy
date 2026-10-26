-- Existing recommendation facts, images, post state and version remain unchanged.
ALTER TABLE bb_category ADD COLUMN merchant_id bigint REFERENCES bb_user(id);
ALTER TABLE bb_category ADD COLUMN tag_key varchar(100);
CREATE UNIQUE INDEX uq_category_owner_label ON bb_category(merchant_id, tag_key)
    WHERE merchant_id IS NOT NULL AND tag_key IS NOT NULL;
ALTER TABLE bb_recommendation_item ADD COLUMN category_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE bb_recommendation_item ADD CONSTRAINT ck_recommendation_category_array CHECK(jsonb_typeof(category_ids) = 'array');
ALTER TABLE bb_recommendation_item ADD COLUMN supplier_id varchar(255) REFERENCES bb_supplier(id);
ALTER TABLE bb_recommendation_item ADD COLUMN show_supplier boolean NOT NULL DEFAULT false;
ALTER TABLE bb_recommendation_item ADD CONSTRAINT ck_recommendation_supplier_display CHECK(NOT show_supplier OR supplier_id IS NOT NULL);
