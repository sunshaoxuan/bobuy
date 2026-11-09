-- Nullable, source-reviewed calendar dates. Existing posts stay explicitly unknown.
-- No source/date inference, backfill, publication change, or item/image/history rewrite.
ALTER TABLE bb_recommendation_post ADD COLUMN issue_date date;
ALTER TABLE bb_recommendation_post ADD COLUMN issue_date_source_ref varchar(2048);
ALTER TABLE bb_recommendation_post ADD COLUMN issue_date_source_hash varchar(64);
ALTER TABLE bb_recommendation_post ADD COLUMN issue_date_reviewed_by bigint;
ALTER TABLE bb_recommendation_post ADD COLUMN issue_date_reviewed_at timestamp with time zone;
ALTER TABLE bb_recommendation_post ADD CONSTRAINT ck_recommendation_issue_date_review CHECK (
    (issue_date IS NULL AND issue_date_source_ref IS NULL AND issue_date_source_hash IS NULL
        AND issue_date_reviewed_by IS NULL AND issue_date_reviewed_at IS NULL)
    OR
    (issue_date IS NOT NULL AND issue_date_source_ref IS NOT NULL AND length(trim(issue_date_source_ref)) > 0
        AND issue_date_source_hash IS NOT NULL AND issue_date_source_hash ~ '^[0-9a-f]{64}$'
        AND issue_date_reviewed_by IS NOT NULL AND issue_date_reviewed_by > 0 AND issue_date_reviewed_at IS NOT NULL)
);
