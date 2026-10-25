-- Flyway executes this once in a transaction. Release rollback requires a stopped-writer backup restore.
ALTER TABLE bb_trip RENAME COLUMN destination TO delivery_area;
ALTER TABLE bb_trip RENAME COLUMN depart_date TO delivery_date;
ALTER TABLE bb_trip DROP COLUMN origin;
ALTER TABLE bb_trip DROP COLUMN capacity;
ALTER TABLE bb_trip DROP COLUMN reserved_capacity;
DROP INDEX IF EXISTS idx_bb_trip_agent_status_depart;
CREATE INDEX idx_bb_trip_agent_status_delivery ON bb_trip (agent_id, status, delivery_date);
UPDATE bb_trip SET delivery_area = trim(delivery_area);
ALTER TABLE bb_trip ADD CONSTRAINT bb_trip_delivery_area_valid CHECK (length(trim(delivery_area)) > 0);
UPDATE bb_trip SET status = 'PUBLISHED' WHERE status = 'DRAFT';
-- Preserve historical completed/settled freezes; derive active stages from actual orders.
UPDATE bb_trip t SET status = CASE
  WHEN EXISTS (SELECT 1 FROM bb_order_header o WHERE o.trip_id=t.id AND o.status <> 'CANCELLED')
   AND NOT EXISTS (SELECT 1 FROM bb_order_header o WHERE o.trip_id=t.id AND o.status NOT IN ('CANCELLED','DELIVERED','SETTLED')) THEN 'COMPLETED'
  WHEN EXISTS (SELECT 1 FROM bb_order_header o WHERE o.trip_id=t.id AND o.status IN ('PURCHASED','DELIVERED','SETTLED'))
    OR EXISTS (SELECT 1 FROM bb_order_header o CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.lines, '[]'::jsonb)) l WHERE o.trip_id=t.id AND o.status <> 'CANCELLED' AND coalesce((l->>'purchasedQuantity')::integer, 0) > 0) THEN 'IN_PROGRESS'
  ELSE 'PUBLISHED' END
WHERE t.status NOT IN ('COMPLETED','SETTLED');
ALTER TABLE bb_trip DROP CONSTRAINT ck_bb_trip_status;
ALTER TABLE bb_trip ADD CONSTRAINT bb_trip_workflow_status_valid CHECK (status IN ('PUBLISHED','IN_PROGRESS','COMPLETED','SETTLED'));

-- Share the existing database allocator across independently running merchant sessions.
SELECT setval('bb_checkout_ids', GREATEST((SELECT last_value FROM bb_checkout_ids), COALESCE(MAX(id), 0)), true) FROM bb_trip;
