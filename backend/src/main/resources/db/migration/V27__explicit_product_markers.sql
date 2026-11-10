-- Display-only merchant-owned markers. No existing product, order, quote or inventory mutation.
CREATE TABLE bb_product_marker_definition (
 id varchar(36) PRIMARY KEY,
 merchant_id bigint NOT NULL REFERENCES bb_user(id),
 code varchar(40) NOT NULL,
 badge varchar(8) NOT NULL,
 name jsonb NOT NULL DEFAULT '{}'::jsonb,
 description jsonb NOT NULL DEFAULT '{}'::jsonb,
 color varchar(16) NOT NULL,
 sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
 enabled boolean NOT NULL DEFAULT true,
 version bigint NOT NULL DEFAULT 0,
 CONSTRAINT uq_product_marker_owner_code UNIQUE(merchant_id,code),
 CONSTRAINT ck_product_marker_color CHECK(color IN ('red','orange','gold','green','blue','purple','gray')),
 CONSTRAINT ck_product_marker_badge CHECK(char_length(badge)=1)
);
CREATE TABLE bb_product_marker_set (
 product_id varchar(255) PRIMARY KEY REFERENCES bb_product(id),
 merchant_id bigint NOT NULL REFERENCES bb_user(id),
 marker_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(marker_ids)='array'),
 version bigint NOT NULL DEFAULT 0
);
CREATE INDEX ix_product_marker_owner_order ON bb_product_marker_definition(merchant_id,sort_order,id);
CREATE INDEX ix_product_marker_set_owner ON bb_product_marker_set(merchant_id);
-- No inferred assignments, stock changes or hard deletes. Defaults are explicit idempotent admin bootstrap.
