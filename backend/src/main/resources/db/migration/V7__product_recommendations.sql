CREATE TABLE IF NOT EXISTS bb_recommendation_post (
    id bigserial PRIMARY KEY,
    merchant_id bigint NOT NULL REFERENCES bb_user(id),
    title varchar(200) NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    published boolean NOT NULL DEFAULT false,
    version bigint NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp,
    published_at timestamptz,
    publisher_id bigint REFERENCES bb_user(id),
    publisher_name varchar(255),
    CONSTRAINT ck_recommendation_publication CHECK (NOT published OR (length(trim(title)) > 0 AND length(trim(body)) > 0 AND published_at IS NOT NULL AND publisher_id IS NOT NULL AND publisher_name IS NOT NULL AND length(trim(publisher_name)) > 0))
);
CREATE INDEX IF NOT EXISTS ix_recommendation_owner ON bb_recommendation_post(merchant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_recommendation_published ON bb_recommendation_post(published_at DESC) WHERE published;
CREATE TABLE IF NOT EXISTS bb_recommendation_image (
    id varchar(255) PRIMARY KEY,
    merchant_id bigint NOT NULL REFERENCES bb_user(id),
    image_hash varchar(64) NOT NULL,
    content_type varchar(255) NOT NULL,
    content bytea NOT NULL,
    CONSTRAINT uq_recommendation_image UNIQUE(merchant_id, image_hash)
);
CREATE TABLE IF NOT EXISTS bb_recommendation_item (
    id bigserial PRIMARY KEY,
    post_id bigint NOT NULL REFERENCES bb_recommendation_post(id) ON DELETE CASCADE,
    product_id varchar(255) NOT NULL REFERENCES bb_product(id),
    name varchar(200) NOT NULL,
    item_number varchar(255) NOT NULL,
    reference_price numeric(14,2) NOT NULL CHECK(reference_price >= 0),
    image_hash varchar(64) NOT NULL,
    image_url varchar(2048) NOT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT uq_recommendation_item UNIQUE(post_id, product_id, image_hash)
);
CREATE INDEX IF NOT EXISTS ix_recommendation_item_post ON bb_recommendation_item(post_id, id);
