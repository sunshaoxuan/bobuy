CREATE TABLE bb_recommendation_source_artifact (
    sha256 varchar(64) PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    source_ref varchar(2048) NOT NULL UNIQUE,
    content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 10485760),
    content_type varchar(255) NOT NULL,
    byte_length bigint NOT NULL CHECK (byte_length BETWEEN 1 AND 10485760 AND byte_length = octet_length(content)),
    algorithm varchar(64) NOT NULL CHECK (algorithm IN ('recommendation-issue-date-source-v1','recommendation-issue-date-source-html-utf8-v1')),
    acquired_at timestamptz NOT NULL
);

ALTER TABLE bb_recommendation_post ADD COLUMN issue_date_source_algorithm varchar(64);
UPDATE bb_recommendation_post
SET issue_date_source_algorithm = 'legacy-operator-supplied'
WHERE issue_date_source_hash IS NOT NULL;
ALTER TABLE bb_recommendation_post ADD CONSTRAINT ck_recommendation_issue_date_algorithm
CHECK ((issue_date_source_hash IS NULL AND issue_date_source_algorithm IS NULL)
    OR (issue_date_source_hash IS NOT NULL AND issue_date_source_algorithm IS NOT NULL));
