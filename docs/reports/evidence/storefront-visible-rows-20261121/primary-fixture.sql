-- Additional functional-only scope after all A/B timings; never production.
BEGIN;
DO $$ BEGIN IF current_database()<>'manual_create_synthetic' THEN RAISE EXCEPTION 'Synthetic database required'; END IF; END $$;
CREATE TABLE IF NOT EXISTS perf_viewport_path_backup AS SELECT * FROM bb_product_primary_category_path WHERE false;
INSERT INTO perf_viewport_path_backup SELECT p.* FROM bb_product_primary_category_path p WHERE product_id IN (SELECT 'progressive-item-2-'||n FROM generate_series(7,20)n) AND NOT EXISTS(SELECT 1 FROM perf_viewport_path_backup b WHERE b.product_id=p.product_id);
INSERT INTO bb_category_tree_node(id,parent_id,name,full_path,sort_order)
VALUES('progressive-leaf-1b','000-progressive-01','{"zh-CN":"合成两行长名称面包谷物与抹酱","ja-JP":"合成のパンとシリアルとスプレッド","en-US":"Synthetic bread cereals and spreads"}','["000-progressive-01","progressive-leaf-1b"]',2) ON CONFLICT(id) DO NOTHING;
UPDATE bb_product_primary_category_path SET category_node_id='progressive-leaf-1b' WHERE product_id IN (SELECT 'progressive-item-2-'||n FROM generate_series(7,20)n);
COMMIT;
-- Restore only these fourteen bindings after acceptance:
-- UPDATE bb_product_primary_category_path p SET category_node_id=b.category_node_id FROM perf_viewport_path_backup b WHERE p.product_id=b.product_id AND p.category_node_id='progressive-leaf-1b';
-- DELETE FROM bb_category_tree_node WHERE id='progressive-leaf-1b' AND NOT EXISTS(SELECT 1 FROM bb_product_primary_category_path WHERE category_node_id='progressive-leaf-1b');
