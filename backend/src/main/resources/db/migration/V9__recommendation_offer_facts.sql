-- Additive upgrade; existing recommendation and catalog data is retained.
ALTER TABLE bb_recommendation_item ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE bb_recommendation_item ALTER COLUMN item_number DROP NOT NULL;
ALTER TABLE bb_recommendation_item ALTER COLUMN reference_price DROP NOT NULL;
ALTER TABLE bb_recommendation_item ADD COLUMN original_price numeric(14,2) CHECK(original_price >= 0);
ALTER TABLE bb_recommendation_item ADD COLUMN discount_amount numeric(14,2) CHECK(discount_amount >= 0);
ALTER TABLE bb_recommendation_item ADD COLUMN price_unit varchar(100);
ALTER TABLE bb_recommendation_item ADD COLUMN offer_start date;
ALTER TABLE bb_recommendation_item ADD COLUMN offer_end date;
ALTER TABLE bb_recommendation_item ADD COLUMN coupon_start date;
ALTER TABLE bb_recommendation_item ADD COLUMN coupon_end date;
ALTER TABLE bb_recommendation_item ADD COLUMN offer_notes varchar(2000);
ALTER TABLE bb_recommendation_item ADD CONSTRAINT ck_recommendation_offer_dates CHECK(offer_start IS NULL OR offer_end IS NULL OR offer_start <= offer_end);
ALTER TABLE bb_recommendation_item ADD CONSTRAINT ck_recommendation_coupon_dates CHECK(coupon_start IS NULL OR coupon_end IS NULL OR coupon_start <= coupon_end);
