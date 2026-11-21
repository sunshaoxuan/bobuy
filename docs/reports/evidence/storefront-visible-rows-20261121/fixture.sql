-- Only isolated synthetic media: unique URLs are needed to measure image request budgets.
BEGIN;
DO $$ BEGIN IF current_database()<>'manual_create_synthetic' THEN RAISE EXCEPTION 'Synthetic database required'; END IF; END $$;
CREATE TABLE IF NOT EXISTS perf_viewport_fixture_backup AS SELECT id,media_gallery FROM bb_product WHERE id IN (SELECT 'progressive-item-1-'||n FROM generate_series(2,20)n);
INSERT INTO bb_recommendation_image(id,merchant_id,image_hash,content_type,access_scope,content,raw_sha256,byte_length)
SELECT 'viewport-perf-fixture-'||n,1000,md5('viewport-'||n)||md5('viewport-image-'||n),content_type,'PUBLIC',content,raw_sha256,byte_length FROM bb_recommendation_image CROSS JOIN generate_series(2,20)n WHERE id='icon-priority-fixture-01' ON CONFLICT(id) DO NOTHING;
UPDATE bb_product p SET media_gallery=jsonb_build_array(jsonb_build_object('url','/api/storefront/recommendation-images/viewport-perf-fixture-'||n,'type','IMAGE','visible',true,'title','{}'::jsonb)) FROM generate_series(2,20)n WHERE p.id='progressive-item-1-'||n AND p.merchant_id=1000;
COMMIT;
