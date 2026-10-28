-- Preserve every existing PG binary. Only new, explicitly verified object uploads may omit it.
ALTER TABLE bb_recommendation_image ALTER COLUMN content DROP NOT NULL;
ALTER TABLE bb_recommendation_image ADD COLUMN raw_sha256 varchar(64);
ALTER TABLE bb_recommendation_image ADD COLUMN byte_length bigint;
UPDATE bb_recommendation_image SET raw_sha256=encode(sha256(content),'hex'),byte_length=octet_length(content);
ALTER TABLE bb_recommendation_image ALTER COLUMN raw_sha256 SET NOT NULL;
ALTER TABLE bb_recommendation_image ALTER COLUMN byte_length SET NOT NULL;
ALTER TABLE bb_recommendation_image ADD CONSTRAINT bb_image_raw_metadata CHECK(raw_sha256 ~ '^[0-9a-f]{64}$' AND byte_length>0);
ALTER TABLE bb_recommendation_image ADD CONSTRAINT bb_image_retained_bytes_match CHECK(content IS NULL OR (octet_length(content)=byte_length AND encode(sha256(content),'hex')=raw_sha256));
