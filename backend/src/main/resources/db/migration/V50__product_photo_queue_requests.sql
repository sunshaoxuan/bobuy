-- Request aliases retain idempotency when independently submitted photos share a job.
CREATE TABLE bb_product_photo_request (
    request_key varchar(64) PRIMARY KEY,
    job_id varchar(36) NOT NULL REFERENCES bb_costco_onboarding_job(id)
);
CREATE INDEX bb_product_photo_job_hash
    ON bb_costco_onboarding_job (merchant_id, input_hash, created_at, id)
    WHERE payload->>'privatePhotoSha256' IS NOT NULL;
CREATE INDEX bb_product_photo_observation_hash
    ON bb_product_photo_observation (merchant_id, supplier_id, market, photo_sha256);
