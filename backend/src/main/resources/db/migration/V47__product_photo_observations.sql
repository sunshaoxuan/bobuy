-- Additive/private only. Compatible application rollback retains evidence and observations.
CREATE TABLE IF NOT EXISTS bb_product_photo_observation (
 id varchar(36) PRIMARY KEY,
 job_id varchar(36) NOT NULL UNIQUE REFERENCES bb_costco_onboarding_job(id),
 merchant_id bigint NOT NULL,
 supplier_id varchar(100) NOT NULL,
 market varchar(2) NOT NULL,
 product_id varchar(255) NOT NULL REFERENCES bb_product(id),
 request_hash varchar(64) NOT NULL,
 amount numeric(19,4), currency varchar(3), unit varchar(100), conditions varchar(1000),
 in_stock boolean NOT NULL,
 price_changed boolean NOT NULL,
 observed_at timestamptz NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT current_timestamp,
 photo_sha256 varchar(64) NOT NULL,
 receipt jsonb NOT NULL,
 CHECK (amount IS NULL OR (amount>0 AND amount<=1000000000 AND currency IS NOT NULL AND unit IS NOT NULL)),
 CHECK (amount IS NOT NULL OR in_stock)
);
CREATE INDEX IF NOT EXISTS bb_photo_observation_scope ON bb_product_photo_observation(merchant_id,product_id,supplier_id,market,confirmed_at DESC);
