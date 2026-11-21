-- Isolated fixture only: reuse existing image bytes, no production access or new artwork.
BEGIN;
DO $$ BEGIN IF current_database()<>'manual_create_synthetic' THEN RAISE EXCEPTION 'Synthetic database required'; END IF; END $$;
CREATE TABLE IF NOT EXISTS perf_detail_fixture_backup AS SELECT id,media_gallery FROM bb_product WHERE id='progressive-item-1-1';
INSERT INTO bb_recommendation_image(id,merchant_id,image_hash,content_type,access_scope,content,raw_sha256,byte_length)
SELECT 'detail-perf-fixture-'||n,1000,md5(image_hash||'-detail-'||n)||md5('detail-'||n),content_type,'PUBLIC',content,raw_sha256,byte_length FROM bb_recommendation_image CROSS JOIN generate_series(1,4)n WHERE id='icon-priority-fixture-01'
ON CONFLICT(id) DO NOTHING;
UPDATE bb_product SET media_gallery=(SELECT jsonb_agg(jsonb_build_object('url','/api/storefront/recommendation-images/detail-perf-fixture-'||n,'type','IMAGE','visible',true,'title','{}'::jsonb) ORDER BY n) FROM generate_series(1,4)n) WHERE id='progressive-item-1-1' AND merchant_id=1000;
COMMIT;
