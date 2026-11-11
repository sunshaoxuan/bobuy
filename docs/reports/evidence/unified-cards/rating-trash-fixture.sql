-- Only the isolated synthetic bobuy_cards_20261111 database.
BEGIN;
INSERT INTO bb_product_rating(product_id,merchant_id,stars,public_visible,version,reviewed_at)
VALUES('demo-chicken',1000,4.5,true,1,now()),('demo-milk',1000,3,false,1,now())
ON CONFLICT(product_id) DO UPDATE SET stars=excluded.stars,public_visible=excluded.public_visible;
UPDATE bb_recommendation_item SET product_id=CASE item_number WHEN 'TEST-1' THEN 'demo-chicken' WHEN 'TEST-2' THEN 'demo-milk' ELSE NULL END WHERE post_id IN(-31111,931111);
INSERT INTO bb_product SELECT (jsonb_populate_record(NULL::bb_product,to_jsonb(p)||jsonb_build_object('id','card-trash-fixture','name',jsonb_build_object('zh-CN',repeat('回收站长商品名',12),'ja-JP','Synthetic trash product'),'deleted_at',now(),'deleted_by',1000))).* FROM bb_product p WHERE id='demo-spinach' ON CONFLICT(id) DO NOTHING;
COMMIT;
