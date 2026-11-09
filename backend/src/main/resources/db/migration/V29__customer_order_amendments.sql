-- Additive; V28 and all historical order values remain unchanged.
ALTER TABLE bb_order_header ADD COLUMN order_revision bigint NOT NULL DEFAULT 0;
CREATE TABLE bb_customer_order_amendment (
    id varchar(128) PRIMARY KEY,
    customer_id bigint NOT NULL,
    request_id varchar(36) NOT NULL,
    order_id bigint NOT NULL,
    payload_hash varchar(64) NOT NULL,
    original_order jsonb NOT NULL,
    result_view jsonb NOT NULL,
    created_at timestamp NOT NULL,
    CONSTRAINT uk_customer_order_amendment_request UNIQUE (customer_id, request_id)
);
-- Receipt rows deliberately survive later order removal; no cascade or historical backfill.
