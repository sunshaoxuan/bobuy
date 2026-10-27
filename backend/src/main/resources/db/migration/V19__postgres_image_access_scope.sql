-- Existing published product image bytes and identities remain unchanged.
ALTER TABLE bb_recommendation_image ADD COLUMN access_scope varchar(16) NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE bb_recommendation_image ADD CONSTRAINT bb_image_access_scope CHECK (access_scope IN ('PUBLIC','PRIVATE'));
