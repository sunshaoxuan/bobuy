-- Legacy merchant scores remain audit-only; no user reviews are synthesized.
COMMENT ON TABLE bb_product_rating IS 'Legacy merchant scores, audit only. Excluded from user review aggregates.';
CREATE TABLE bb_product_review (
 id bigserial PRIMARY KEY,
 product_id varchar(255) NOT NULL REFERENCES bb_product(id),
 user_id bigint NOT NULL REFERENCES bb_user(id),
 stars numeric NOT NULL CHECK(stars BETWEEN 1 AND 5 AND mod(stars*2,1)=0),
 comment varchar(2000) NOT NULL DEFAULT '',
 version bigint NOT NULL CHECK(version>0),
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 CONSTRAINT uq_product_review_author UNIQUE(product_id,user_id)
);
CREATE INDEX ix_product_review_list ON bb_product_review(product_id,updated_at DESC,id DESC);
