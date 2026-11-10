-- Additive only. Historical orders retain NULL (delivery facts were not captured).
-- Previous applications omit these columns on UPDATE, preserving new snapshots.
ALTER TABLE bb_order_header ADD COLUMN delivery_snapshot jsonb;
ALTER TABLE bb_order_header ADD COLUMN checkout_payload_hash varchar(64);
