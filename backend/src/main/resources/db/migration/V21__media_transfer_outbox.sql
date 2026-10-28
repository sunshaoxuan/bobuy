-- Additive only: existing image bytes, IDs, scopes and business references remain intact.
CREATE TABLE bb_media_catalog_guard(id bigint PRIMARY KEY CHECK(id=1));
INSERT INTO bb_media_catalog_guard(id) VALUES(1);
CREATE TABLE bb_media_blob (
 sha256 varchar(64) PRIMARY KEY, byte_length bigint NOT NULL CHECK(byte_length>0),
 content_type varchar(255) NOT NULL, busy_until timestamptz, gc_candidate_at timestamptz,
 version bigint NOT NULL DEFAULT 0
);
CREATE TABLE bb_media_reference (
 image_id varchar(255) PRIMARY KEY REFERENCES bb_recommendation_image(id) ON DELETE CASCADE,
 blob_sha256 varchar(64) NOT NULL REFERENCES bb_media_blob(sha256)
);
CREATE INDEX bb_media_reference_blob ON bb_media_reference(blob_sha256);
CREATE TABLE bb_media_transfer (
 image_id varchar(255) PRIMARY KEY REFERENCES bb_recommendation_image(id) ON DELETE CASCADE,
 raw_sha256 varchar(64) NOT NULL,
 object_key varchar(600) NOT NULL,
 byte_length bigint NOT NULL CHECK(byte_length > 0),
 content_type varchar(255) NOT NULL,
 state varchar(16) NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','RETRY','VERIFIED')),
 attempts integer NOT NULL DEFAULT 0,
 lease_token varchar(36), lease_until timestamptz, verified_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT current_timestamp,
 version bigint NOT NULL DEFAULT 0
);
CREATE INDEX bb_media_transfer_pending ON bb_media_transfer(state,updated_at);
