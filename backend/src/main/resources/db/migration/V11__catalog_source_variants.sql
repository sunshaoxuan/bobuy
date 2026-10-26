-- An official item code is not a global product identity: merchant and channel
-- variants can share it. Existing IDs, prices, stock and offer rows stay intact.
ALTER TABLE bb_product DROP CONSTRAINT uk_bb_product_item_number;
CREATE INDEX idx_bb_product_owner_item_number ON bb_product(merchant_id, item_number);
