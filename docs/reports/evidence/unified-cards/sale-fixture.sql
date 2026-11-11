-- Synthetic prices only in bobuy_cards_20261111. No orders are created.
UPDATE bb_product SET sale=jsonb_build_object('amount',980,'currency','JPY','unit','pack','revision',1,'enabled',true) WHERE id='demo-chicken';
UPDATE bb_product SET sale=jsonb_build_object('amount',999999999999.99,'currency','JPY','unit','pack','revision',1,'enabled',true) WHERE id='demo-milk';
UPDATE bb_product SET sale=sale||jsonb_build_object('reviewedBy',1000,'reviewedAt',now()) WHERE id IN('demo-chicken','demo-milk');
UPDATE bb_product SET order_method='PRE_ORDER' WHERE id IN('demo-chicken','demo-milk');
UPDATE bb_product SET sale=sale||jsonb_build_object('amount',999999999999) WHERE id='demo-milk';
