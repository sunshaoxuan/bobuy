-- Explicit service articles; legacy product issues and all goods associations remain unchanged.
ALTER TABLE bb_recommendation_post ADD COLUMN service_offer jsonb;
ALTER TABLE bb_recommendation_post ADD COLUMN service_source_key varchar(64);
ALTER TABLE bb_recommendation_post ADD CONSTRAINT ck_recommendation_service_source CHECK ((service_offer IS NULL) = (service_source_key IS NULL));
CREATE UNIQUE INDEX uq_recommendation_service_source ON bb_recommendation_post(merchant_id,service_source_key);
