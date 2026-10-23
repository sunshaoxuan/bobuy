ALTER TABLE bb_user ADD COLUMN roles jsonb;
UPDATE bb_user SET roles = CASE WHEN role = 'CUSTOMER' THEN '["CUSTOMER"]'::jsonb WHEN role IN ('AGENT', 'MERCHANT') THEN '["AGENT"]'::jsonb END;
ALTER TABLE bb_user ALTER COLUMN roles SET NOT NULL;
ALTER TABLE bb_user ADD CONSTRAINT bb_user_roles_valid CHECK (
  roles IN ('["CUSTOMER"]'::jsonb, '["AGENT"]'::jsonb, '["CUSTOMER","AGENT"]'::jsonb, '["AGENT","CUSTOMER"]'::jsonb)
);
ALTER TABLE bb_user ADD COLUMN platform_admin boolean NOT NULL DEFAULT false;
UPDATE bb_user SET platform_admin = true WHERE username = 'admin' AND role IN ('AGENT', 'MERCHANT');
ALTER TABLE bb_user DROP COLUMN role;
