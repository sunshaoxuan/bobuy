ALTER TABLE bb_user ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE;
-- Existing catalog ownership is unambiguous only for the single-merchant pilot.
DO $$ BEGIN
    IF (SELECT count(*) FROM bb_user WHERE role = 'AGENT') > 1 OR
        ((SELECT count(*) FROM bb_user WHERE role = 'AGENT') = 0 AND
         (EXISTS (SELECT 1 FROM bb_product) OR EXISTS (SELECT 1 FROM bb_supplier))) THEN
        RAISE EXCEPTION 'Map legacy catalog owners explicitly before V4 on a multi-agent database';
    END IF;
END $$;
ALTER TABLE bb_product ADD COLUMN merchant_id BIGINT REFERENCES bb_user(id);
ALTER TABLE bb_supplier ADD COLUMN merchant_id BIGINT REFERENCES bb_user(id);
UPDATE bb_product SET merchant_id = (SELECT min(id) FROM bb_user WHERE role = 'AGENT');
UPDATE bb_supplier SET merchant_id = (SELECT min(id) FROM bb_user WHERE role = 'AGENT');
CREATE UNIQUE INDEX uk_bb_user_username_lower ON bb_user (lower(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX uk_bb_user_email_lower ON bb_user (lower(email)) WHERE email IS NOT NULL AND email <> '';
CREATE SEQUENCE bb_checkout_ids START WITH 1000000 INCREMENT BY 1;
SELECT setval('bb_checkout_ids', greatest(1000000, (SELECT coalesce(max(id),0)+1 FROM bb_user),
    (SELECT coalesce(max(id),0)+1 FROM bb_order_header)), false);
CREATE TABLE bb_checkout_identity (id BIGINT PRIMARY KEY);
CREATE TABLE bb_email_challenge (
    user_id BIGINT PRIMARY KEY REFERENCES bb_user(id),
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5)
);
CREATE TABLE bb_merchant_customer (
    id VARCHAR(255) PRIMARY KEY,
    merchant_id BIGINT NOT NULL REFERENCES bb_user(id),
    customer_id BIGINT NOT NULL REFERENCES bb_user(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by BIGINT REFERENCES bb_user(id),
    UNIQUE (merchant_id, customer_id)
);
CREATE INDEX ix_bb_order_customer_trip ON bb_order_header(customer_id, trip_id);
