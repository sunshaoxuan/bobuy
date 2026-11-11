-- Synthetic UI fixtures. Only execute in bobuy_cards_20261111.
BEGIN;
INSERT INTO bb_recommendation_post(id,merchant_id,title,body)
VALUES(-31111,1000,'Card layout synthetic fixture','Synthetic draft for product card layout verification.');
INSERT INTO bb_recommendation_item(post_id,name,item_number,reference_price,image_hash,image_url,price_unit,offer_notes)
VALUES(-31111,'Short name','TEST-1',1234,repeat('1',64),'/assets/products/chicken.png','pack','Synthetic condition retained'),
(-31111,repeat('Long product name ',8),'TEST-2',999999999999.99,repeat('2',64),'/assets/products/milk.png','maximum price test unit','Synthetic maximum price'),
(-31111,'商品名称测试 商品名称测试 商品名称测试','TEST-3',NULL,repeat('3',64),'/assets/products/spinach.png',NULL,NULL);
COMMIT;
