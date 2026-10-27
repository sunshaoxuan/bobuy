ALTER TABLE bb_product ADD COLUMN deleted_at timestamptz;
ALTER TABLE bb_product ADD COLUMN deleted_by bigint;
CREATE INDEX bb_product_deleted_at ON bb_product(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE TABLE bb_product_lifecycle_event (
 id varchar(36) PRIMARY KEY,
 product_id varchar(255) NOT NULL REFERENCES bb_product(id),
 action varchar(16) NOT NULL CHECK(action IN ('DELETE','RESTORE')),
 actor_id bigint NOT NULL,
 occurred_at timestamptz NOT NULL
);
