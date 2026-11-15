ALTER TABLE bb_password_reset_token ADD COLUMN email_hash VARCHAR(64);
-- Tokens created before the binding existed must not remain usable.
DELETE FROM bb_password_reset_token;
ALTER TABLE bb_password_reset_token ALTER COLUMN email_hash SET NOT NULL;
