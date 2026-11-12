CREATE TABLE IF NOT EXISTS bb_product_click (
 product_id varchar(255) PRIMARY KEY REFERENCES bb_product(id),
 clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0)
);
