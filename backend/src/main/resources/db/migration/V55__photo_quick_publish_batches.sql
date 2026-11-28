CREATE TABLE bb_photo_publish_batch (
    id uuid PRIMARY KEY,
    merchant_id bigint NOT NULL REFERENCES bb_user(id),
    supplier_id varchar(100) NOT NULL REFERENCES bb_supplier(id),
    market char(2) NOT NULL,
    request_key varchar(100) NOT NULL,
    state varchar(32) NOT NULL DEFAULT 'OPEN',
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp,
    UNIQUE (merchant_id, request_key)
);

CREATE TABLE bb_photo_publish_item (
    id uuid PRIMARY KEY,
    batch_id uuid NOT NULL REFERENCES bb_photo_publish_batch(id),
    merchant_id bigint NOT NULL REFERENCES bb_user(id),
    request_key varchar(100) NOT NULL,
    onboarding_job_id varchar(36) NOT NULL REFERENCES bb_costco_onboarding_job(id),
    state varchar(32) NOT NULL DEFAULT 'PROCESSING',
    product_id varchar(255),
    issue_code varchar(100),
    excluded boolean NOT NULL DEFAULT false,
    revision bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp,
    UNIQUE (batch_id, request_key),
    UNIQUE (merchant_id, onboarding_job_id)
);
CREATE INDEX bb_photo_publish_item_pending ON bb_photo_publish_item(state,updated_at) WHERE excluded=false;

CREATE TABLE bb_official_image_lookup (
    id uuid PRIMARY KEY,
    batch_id uuid NOT NULL REFERENCES bb_photo_publish_batch(id),
    item_id uuid NOT NULL UNIQUE REFERENCES bb_photo_publish_item(id),
    merchant_id bigint NOT NULL REFERENCES bb_user(id),
    product_id varchar(255) NOT NULL REFERENCES bb_product(id),
    state varchar(32) NOT NULL DEFAULT 'QUEUED',
    candidate_url text,
    source_page text,
    match_basis text,
    issue_code varchar(100),
    attempts integer NOT NULL DEFAULT 0,
    lease_token uuid,
    lease_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX bb_official_image_lookup_queue ON bb_official_image_lookup(state,created_at) WHERE state IN ('QUEUED','RETRY');
