-- Additive R13 only. Existing products, prices, images, orders and V28 data remain unchanged.
CREATE TABLE bb_costco_onboarding_job (
 id varchar(36) PRIMARY KEY, merchant_id bigint NOT NULL, supplier_id varchar(100) NOT NULL,
 market varchar(2) NOT NULL, idempotency_key varchar(64) NOT NULL UNIQUE,
 input_hash varchar(64) NOT NULL, revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 state varchar(24) NOT NULL CHECK(state IN ('QUEUED','AI_INTAKE','EVIDENCE_FETCH','AI_REVIEW','COMMITTING','COMPLETED','NEEDS_INPUT','RETRY_WAIT','FAILED','CANCELLED')),
 payload jsonb NOT NULL, attempt_history jsonb NOT NULL DEFAULT '[]', attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 lease_token varchar(36), lease_until timestamptz, next_run_at timestamptz NOT NULL DEFAULT current_timestamp,
 created_at timestamptz NOT NULL DEFAULT current_timestamp,updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX bb_costco_onboarding_pending ON bb_costco_onboarding_job(state,next_run_at);
CREATE INDEX bb_costco_onboarding_owner ON bb_costco_onboarding_job(merchant_id,updated_at DESC);
CREATE TABLE bb_costco_onboarding_evidence (
 merchant_id bigint NOT NULL, sha256 varchar(64) NOT NULL, supplier_id varchar(100), input_hash varchar(64),
 kind varchar(20) NOT NULL CHECK(kind IN ('PRIVATE_PHOTO','OFFICIAL_EVIDENCE')),
 content_type varchar(255) NOT NULL, content bytea NOT NULL, receipt jsonb,
 created_at timestamptz NOT NULL DEFAULT current_timestamp,
 PRIMARY KEY(merchant_id,sha256), CHECK(octet_length(content)>0 AND octet_length(content)<=8388608)
);
CREATE TABLE bb_costco_onboarding_commit (
 idempotency_key varchar(64) PRIMARY KEY REFERENCES bb_costco_onboarding_job(idempotency_key),
 merchant_id bigint NOT NULL, candidate_hash varchar(64) NOT NULL,
 product_id varchar(255) NOT NULL REFERENCES bb_product(id), product_version bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT current_timestamp
);
