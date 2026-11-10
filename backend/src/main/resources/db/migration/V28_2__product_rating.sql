-- Additive only: no default scores and no edits to existing products, offers or histories.
CREATE TABLE bb_product_rating (
 product_id varchar(255) PRIMARY KEY REFERENCES bb_product(id),
 merchant_id bigint NOT NULL REFERENCES bb_user(id),
 stars numeric(2,1),
 public_visible boolean NOT NULL DEFAULT false,
 version bigint NOT NULL CHECK (version > 0),
 reviewed_at timestamp with time zone NOT NULL,
 CONSTRAINT ck_product_rating_stars CHECK (stars IS NULL OR (stars >= 0 AND stars <= 5 AND mod(stars * 2, 1) = 0)),
 CONSTRAINT ck_product_rating_visibility CHECK (NOT public_visible OR stars IS NOT NULL)
);
