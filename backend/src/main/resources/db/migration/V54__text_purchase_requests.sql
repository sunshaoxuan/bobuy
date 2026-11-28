-- Text purchase requests are independent lines: they must never merge with catalog additions.
ALTER TABLE bb_live_cart_line ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE bb_live_cart_line ADD COLUMN request_batch_id UUID;
ALTER TABLE bb_live_cart_line ADD COLUMN original_request VARCHAR(4000);
ALTER TABLE bb_live_cart_line ADD COLUMN original_submission VARCHAR(12000);
ALTER TABLE bb_live_cart_line ADD COLUMN requested_name VARCHAR(500);
ALTER TABLE bb_live_cart_line ADD COLUMN requested_unit VARCHAR(100);
ALTER TABLE bb_live_cart_line ADD COLUMN request_constraints VARCHAR(1000);
ALTER TABLE bb_live_cart_line ADD COLUMN quantity_confirmed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE bb_live_cart_line ADD CONSTRAINT ck_live_cart_request_identity
  CHECK (product_id IS NOT NULL OR original_request IS NOT NULL);

CREATE TABLE bb_live_cart_request_batch (
 id UUID PRIMARY KEY, cart_id BIGINT NOT NULL REFERENCES bb_live_cart(id), customer_id BIGINT NOT NULL REFERENCES bb_user(id),
 merchant_id BIGINT NOT NULL REFERENCES bb_user(id), operation_id UUID NOT NULL, input_hash VARCHAR(64) NOT NULL,
 created_cart_version BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), undone_at TIMESTAMPTZ,
 CONSTRAINT uq_live_cart_request_operation UNIQUE(customer_id,merchant_id,operation_id)
);
CREATE INDEX ix_live_cart_request_batch_cart ON bb_live_cart_request_batch(cart_id,created_at DESC);

-- Audit history survives deletion of a line.
ALTER TABLE bb_live_cart_event DROP CONSTRAINT IF EXISTS bb_live_cart_event_line_id_fkey;
ALTER TABLE bb_live_cart_event ADD CONSTRAINT bb_live_cart_event_line_id_fkey
 FOREIGN KEY(line_id) REFERENCES bb_live_cart_line(id) ON DELETE SET NULL;
