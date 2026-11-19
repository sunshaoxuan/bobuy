-- Synthetic fixture only: existing loopback manual_create_synthetic PostgreSQL 18.6.
-- Never execute against a business database.
DO $$ BEGIN IF current_database()<>'manual_create_synthetic' THEN RAISE EXCEPTION 'Synthetic database required'; END IF; END $$;
BEGIN;
INSERT INTO bb_category_tree_node(id,parent_id,name,full_path,sort_order,explicit_order)
SELECT '000-progressive-'||lpad(i::text,2,'0'),NULL,jsonb_build_object('ja-JP','合成カテゴリー '||i,'zh-CN','合成分类 '||i,'zh-TW','合成分類 '||i,'en-US','Synthetic category '||i),jsonb_build_array('000-progressive-'||lpad(i::text,2,'0')),0,true FROM generate_series(1,23)i ON CONFLICT(id) DO NOTHING;
INSERT INTO bb_category_tree_node(id,parent_id,name,full_path,sort_order,explicit_order)
SELECT 'progressive-leaf-'||i,'000-progressive-'||lpad(i::text,2,'0'),jsonb_build_object('ja-JP','合成の日用品と暮らしのおすすめ '||i,'zh-CN','合成日用商品 '||i,'zh-TW','合成日用商品 '||i,'en-US','Synthetic everyday essentials '||i),jsonb_build_array('000-progressive-'||lpad(i::text,2,'0'),'progressive-leaf-'||i),0,true FROM generate_series(1,23)i ON CONFLICT(id) DO NOTHING;
INSERT INTO bb_product(id,merchant_id,name,description,brand,item_number,media_gallery,visibility_status,storage_condition,order_method,attributes)
SELECT 'progressive-item-'||i||'-'||j,1000,jsonb_build_object('ja-JP','合成商品 '||i||' / '||j,'zh-CN','合成商品 '||i||' / '||j,'zh-TW','合成商品 '||i||' / '||j,'en-US','Synthetic product '||i||' / '||j),jsonb_build_object('ja-JP',repeat('Synthetic description. ',12)),'SYNTHETIC','SYNTHETIC-PROGRESSIVE-'||i||'-'||j,jsonb_build_array(jsonb_build_object('url','/progressive-fixture-images/'||i||'-'||j||'.svg','type','IMAGE','visible',true,'title',jsonb_build_object('ja-JP','合成画像'))),'PUBLIC','AMBIENT','PRE_ORDER','{}'::jsonb FROM generate_series(1,23)i CROSS JOIN generate_series(1,20)j ON CONFLICT(id) DO NOTHING;
INSERT INTO bb_product_primary_category_path(product_id,category_node_id) SELECT 'progressive-item-'||i||'-'||j,'progressive-leaf-'||i FROM generate_series(1,23)i CROSS JOIN generate_series(1,20)j ON CONFLICT(product_id) DO NOTHING;
INSERT INTO bb_product(id,merchant_id,name,description,brand,item_number,visibility_status) VALUES('progressive-private',1000,'{"ja-JP":"PRIVATE MUST NOT LEAK"}','{}','PRIVATE','SYNTHETIC-PRIVATE','DRAFTER_ONLY') ON CONFLICT(id) DO NOTHING;
UPDATE bb_category_tree_node SET image_url='/api/storefront/recommendation-images/progressive-icon-'||right(id,2) WHERE id IN ('000-progressive-01','000-progressive-02');
COMMIT;
