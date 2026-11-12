-- ERP price documents are the sole promotion authority. No source-snapshot fallback.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE offer_marker_run(result jsonb) ON COMMIT DROP;
DO $$
DECLARE owner bigint; p record; d record; s record; offer record; baseline numeric;
 now_at timestamptz := transaction_timestamp(); today date;
 active boolean; unknown boolean; old_ids jsonb; new_ids jsonb;
 scanned integer := 0; added integer := 0; removed integer := 0; unchanged integer := 0;
 uncertain integer := 0; disabled integer := 0; created integer := 0; changes jsonb := '[]';
BEGIN
 IF NOT pg_try_advisory_xact_lock(680021,1) THEN RAISE EXCEPTION 'Offer marker sync already running'; END IF;
 today := (now_at AT TIME ZONE 'Asia/Tokyo')::date;
 PERFORM id FROM bb_user WHERE id IN (SELECT merchant_id FROM bb_product WHERE deleted_at IS NULL) ORDER BY id FOR UPDATE;
 FOR owner IN SELECT DISTINCT merchant_id FROM bb_product WHERE deleted_at IS NULL AND merchant_id IS NOT NULL ORDER BY merchant_id LOOP
  SELECT * INTO d FROM bb_product_marker_definition WHERE merchant_id=owner AND code='discount' FOR UPDATE;
  FOR p IN SELECT * FROM bb_product WHERE merchant_id=owner AND deleted_at IS NULL ORDER BY id FOR UPDATE LOOP
   scanned := scanned+1; active := false; unknown := false;
   FOR offer IN SELECT head.id,head.channel,head.currency,line.amount,line.before_amount,line.unit,
    (SELECT count(*) FROM bb_product_price_adjustment other JOIN bb_product_price_adjustment_line ol ON ol.document_id=other.id
      WHERE ol.product_id=p.id AND other.merchant_id=owner AND other.channel=head.channel AND other.currency=head.currency
      AND ol.unit=line.unit AND other.type<>'PERMANENT' AND other.status='APPROVED' AND other.approved_at<=now_at
      AND other.starts_at<=now_at AND now_at<other.ends_at) AS overlay_count,
    (SELECT pl.amount FROM bb_product_price_adjustment permanent JOIN bb_product_price_adjustment_line pl ON pl.document_id=permanent.id
      WHERE pl.product_id=p.id AND permanent.merchant_id=owner AND permanent.channel=head.channel AND permanent.currency=head.currency
      AND pl.unit=line.unit AND permanent.type='PERMANENT' AND permanent.status='APPROVED' AND permanent.approved_at<=now_at
      AND permanent.starts_at<=now_at AND permanent.ends_at IS NULL ORDER BY permanent.starts_at DESC,permanent.id DESC LIMIT 1) AS regular
    FROM bb_product_price_adjustment head JOIN bb_product_price_adjustment_line line ON line.document_id=head.id
    WHERE line.product_id=p.id AND head.merchant_id=owner AND head.type='PROMOTION' AND head.status='APPROVED'
      AND head.approved_at<=now_at AND head.starts_at<=now_at AND now_at<head.ends_at
      AND (head.evidence->>'sourceItemNumber' IS NULL OR head.evidence->>'sourceItemNumber'=p.item_number) LOOP
    IF offer.overlay_count<>1 THEN unknown := true; CONTINUE; END IF;
    baseline := COALESCE(offer.regular,offer.before_amount);
    IF offer.channel='STOREFRONT' THEN
     IF p.sale IS NULL OR p.sale->>'enabled'<>'true' OR p.order_method<>'PRE_ORDER' OR p.sale->>'currency' IS DISTINCT FROM offer.currency
        OR p.sale->>'unit' IS DISTINCT FROM offer.unit OR
        (p.sale->>'validFrom' IS NOT NULL AND (p.sale->>'validFrom')::date>today) OR
        (p.sale->>'validThrough' IS NOT NULL AND (p.sale->>'validThrough')::date<today) OR
        NOT EXISTS(SELECT 1 FROM bb_currency c WHERE c.code=offer.currency AND c.sale_enabled) THEN CONTINUE; END IF;
     baseline := COALESCE(offer.regular,(p.sale->>'amount')::numeric);
    ELSIF offer.channel NOT IN ('COSTCO_WAREHOUSE','COSTCO_ONLINE') THEN unknown := true; CONTINUE;
    END IF;
    active := active OR COALESCE(baseline>0 AND offer.amount>0 AND offer.amount<baseline,false);
   END LOOP;
   SELECT * INTO s FROM bb_product_marker_set WHERE product_id=p.id FOR UPDATE;
   IF s.product_id IS NOT NULL AND s.merchant_id<>owner THEN RAISE EXCEPTION 'Marker owner mismatch'; END IF;
   old_ids := COALESCE(s.marker_ids,'[]'); new_ids := old_ids;
   IF NOT active AND unknown THEN uncertain := uncertain+1; CONTINUE; END IF;
   IF d.id IS NULL AND active THEN
    INSERT INTO bb_product_marker_definition(id,merchant_id,code,badge,name,description,color,sort_order,enabled,version)
    VALUES(gen_random_uuid()::text,owner,'discount','折','{"ja-JP":"割引","zh-CN":"优惠","zh-TW":"優惠","en-US":"Discount"}','{}','red',10,true,0) RETURNING * INTO d;
    created := created+1;
   END IF;
   IF d.id IS NULL THEN unchanged := unchanged+1; CONTINUE; END IF;
   IF NOT d.enabled THEN disabled := disabled+1; CONTINUE; END IF;
   IF active AND NOT old_ids ? d.id THEN
    IF jsonb_array_length(old_ids)>=50 THEN uncertain := uncertain+1; CONTINUE; END IF;
    new_ids := old_ids || jsonb_build_array(d.id); added := added+1;
   ELSIF NOT active AND old_ids ? d.id THEN new_ids := old_ids-d.id; removed := removed+1;
   ELSE unchanged := unchanged+1; CONTINUE;
   END IF;
   INSERT INTO bb_product_marker_set(product_id,merchant_id,marker_ids,version) VALUES(p.id,owner,new_ids,0)
    ON CONFLICT(product_id) DO UPDATE SET marker_ids=EXCLUDED.marker_ids,version=bb_product_marker_set.version+1;
   changes := changes || jsonb_build_array(jsonb_build_object('productId',p.id,'merchantId',owner,
     'before',old_ids,'after',new_ids,'beforeVersion',s.version,'afterVersion',COALESCE(s.version+1,0)));
  END LOOP;
 END LOOP;
 INSERT INTO offer_marker_run VALUES(jsonb_build_object('at',now_at,'day',today,'timezone','Asia/Tokyo',
  'scanned',scanned,'added',added,'removed',removed,'unchanged',unchanged,'uncertain',uncertain,
  'disabled',disabled,'definitionsCreated',created,'changes',changes));
END $$;
SELECT result FROM offer_marker_run;
COMMIT;
