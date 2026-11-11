-- UI fixtures only, isolated bobuy_cards_20261111 database.
BEGIN;
INSERT INTO bb_recommendation_post(id,merchant_id,title,body,published,published_at,publisher_id,publisher_name)
VALUES(931111,1000,'Synthetic public card fixture','Synthetic UI verification only.',true,current_timestamp,1000,'Synthetic test');
INSERT INTO bb_recommendation_item(post_id,name,item_number,reference_price,image_hash,image_url,publication_state,published_at,published_by,publication_snapshot)
SELECT 931111,name,item_number,reference_price,image_hash,image_url,'PUBLISHED',current_timestamp,1000,
jsonb_build_object('version',1,'legacy',true,'name',name,'itemNumber',item_number,'referencePrice',reference_price,'priceUnit',price_unit,'translations','{}'::jsonb,'gallery','[]'::jsonb,'categoryIds','[]'::jsonb,'imageUrl',image_url)
FROM bb_recommendation_item WHERE post_id=-31111;
COMMIT;
