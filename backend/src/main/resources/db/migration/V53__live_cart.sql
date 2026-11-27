CREATE TABLE bb_live_cart (
 id BIGSERIAL PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES bb_user(id), merchant_id BIGINT NOT NULL REFERENCES bb_user(id),
 version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT uq_live_cart_customer_merchant UNIQUE(customer_id, merchant_id)
);
CREATE TABLE bb_live_cart_settlement (
 id BIGSERIAL PRIMARY KEY, cart_id BIGINT NOT NULL REFERENCES bb_live_cart(id), settled_by BIGINT NOT NULL REFERENCES bb_user(id), settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 line_count INTEGER NOT NULL, item_count INTEGER NOT NULL, amount NUMERIC(19,4) NOT NULL, unpriced_item_count INTEGER NOT NULL DEFAULT 0, currency VARCHAR(3),
 reopened_by BIGINT REFERENCES bb_user(id), reopened_at TIMESTAMPTZ, reopen_note VARCHAR(1000)
);
CREATE TABLE bb_live_cart_line (
 id BIGSERIAL PRIMARY KEY, cart_id BIGINT NOT NULL REFERENCES bb_live_cart(id), product_id VARCHAR(255) NOT NULL REFERENCES bb_product(id), quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
 unit_price NUMERIC(19,4), currency VARCHAR(3) NOT NULL DEFAULT 'JPY', price_source VARCHAR(30) NOT NULL, ready_by BIGINT REFERENCES bb_user(id), ready_at TIMESTAMPTZ,
 settlement_id BIGINT REFERENCES bb_live_cart_settlement(id), visible_to_customer BOOLEAN NOT NULL DEFAULT true, added_by VARCHAR(20) NOT NULL,
 added_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), version BIGINT NOT NULL DEFAULT 0,
 ready_quantity INTEGER, CONSTRAINT ck_live_cart_price CHECK(unit_price IS NULL OR unit_price >= 0)
);
-- Customer additions merge with their one visible open line; hidden procurement rows remain independent.
CREATE INDEX ix_live_cart_customer_open_product ON bb_live_cart_line(cart_id, product_id) WHERE settlement_id IS NULL AND visible_to_customer AND added_by='CUSTOMER';
CREATE INDEX ix_live_cart_line_cart ON bb_live_cart_line(cart_id);
CREATE INDEX ix_live_cart_line_settlement ON bb_live_cart_line(settlement_id);
CREATE TABLE bb_live_cart_event (
 id BIGSERIAL PRIMARY KEY, cart_id BIGINT NOT NULL REFERENCES bb_live_cart(id), line_id BIGINT REFERENCES bb_live_cart_line(id), actor_id BIGINT NOT NULL REFERENCES bb_user(id),
 actor_role VARCHAR(20) NOT NULL, action VARCHAR(40) NOT NULL, before_quantity INTEGER, after_quantity INTEGER, before_unit_price NUMERIC(19,4), after_unit_price NUMERIC(19,4),
 note VARCHAR(1000), details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_live_cart_event_cart ON bb_live_cart_event(cart_id, created_at DESC);
