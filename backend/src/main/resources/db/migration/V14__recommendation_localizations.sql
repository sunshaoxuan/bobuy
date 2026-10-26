ALTER TABLE bb_recommendation_item ADD COLUMN specification varchar(1000);
ALTER TABLE bb_recommendation_item ADD COLUMN description varchar(8000);
ALTER TABLE bb_recommendation_item ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
ALTER TABLE bb_recommendation_item ADD COLUMN translated_source varchar(64);
