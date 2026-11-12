-- Runtime transaction only. No persistent functions, tables or source-fact edits.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE offer_marker_run(result jsonb) ON COMMIT DROP;

CREATE FUNCTION pg_temp.offer_marker_state(f jsonb, today date) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE amount numeric; original numeric; reduction numeric; a date; b date; c jsonb;
BEGIN
 IF f IS NULL OR f->>'version' IS DISTINCT FROM '1' THEN RETURN 'UNKNOWN'; END IF;
 amount := (f->>'referencePrice')::numeric;
 original := (f->>'originalPrice')::numeric;
 reduction := (f->>'discountAmount')::numeric;
 IF amount IS NULL THEN RETURN 'NONE'; END IF;
 IF amount < 0 OR amount::text IN ('NaN','Infinity','-Infinity') OR
    original::text IN ('NaN','Infinity','-Infinity') OR reduction::text IN ('NaN','Infinity','-Infinity') THEN RETURN 'UNKNOWN'; END IF;
 IF original < amount OR reduction < 0 THEN RETURN 'UNKNOWN'; END IF;
 IF NOT (COALESCE(original > amount,false) OR COALESCE(reduction > 0,false)) THEN RETURN 'NONE'; END IF;
 c := f->'referenceContext';
 IF c->>'channel' IS NOT NULL AND c->>'channel' NOT IN ('COSTCO_WAREHOUSE','COSTCO_ONLINE') THEN RETURN 'UNKNOWN'; END IF;
 IF (f->>'offerStart' IS NOT NULL AND f->>'offerStart' !~ '^\d{4}-\d{2}-\d{2}$') OR
    (f->>'offerEnd' IS NOT NULL AND f->>'offerEnd' !~ '^\d{4}-\d{2}-\d{2}$') THEN RETURN 'UNKNOWN'; END IF;
 a := (f->>'offerStart')::date; b := (f->>'offerEnd')::date;
 IF c->>'activityApplies' = 'true' AND
    ((a IS NULL AND c->>'activityStart' IS NOT NULL) OR (b IS NULL AND c->>'activityEnd' IS NOT NULL)) THEN
  IF COALESCE(btrim(c->>'windowEvidence'),'') = '' OR
     COALESCE(c->>'sourceUrl','') !~ '^https://[^/@:[:space:]]+(:[0-9]+)?([/?#]|$)' THEN RETURN 'UNKNOWN'; END IF;
  IF (c->>'activityStart' IS NOT NULL AND c->>'activityStart' !~ '^\d{4}-\d{2}-\d{2}$') OR
     (c->>'activityEnd' IS NOT NULL AND c->>'activityEnd' !~ '^\d{4}-\d{2}-\d{2}$') THEN RETURN 'UNKNOWN'; END IF;
  IF (c->>'activityStart')::date > (c->>'activityEnd')::date THEN RETURN 'UNKNOWN'; END IF;
  a := COALESCE(a,(c->>'activityStart')::date); b := COALESCE(b,(c->>'activityEnd')::date);
 END IF;
 IF a > b THEN RETURN 'UNKNOWN'; END IF;
 IF b < today OR a > today THEN RETURN 'NONE'; END IF;
 IF a IS NULL OR b IS NULL THEN RETURN 'UNKNOWN'; END IF;
 RETURN 'ACTIVE';
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR invalid_datetime_format OR numeric_value_out_of_range THEN
 RETURN 'UNKNOWN';
END $$;

DO $$
DECLARE owner bigint; p record; d record; s record; f record; state text;
 now_at timestamptz := transaction_timestamp(); today date;
 active boolean; unknown boolean; regular numeric; cur text; unit_text text;
 actual_count integer; actual_amount numeric; old_ids jsonb; new_ids jsonb;
 scanned integer := 0; added integer := 0; removed integer := 0; unchanged integer := 0;
 uncertain integer := 0; disabled integer := 0; created integer := 0;
 changes jsonb := '[]';
BEGIN
 IF NOT pg_try_advisory_xact_lock(680021,1) THEN RAISE EXCEPTION 'Offer marker sync already running'; END IF;
 today := (now_at AT TIME ZONE 'Asia/Tokyo')::date;
 PERFORM id FROM bb_user WHERE id IN (SELECT merchant_id FROM bb_product WHERE deleted_at IS NULL) ORDER BY id FOR UPDATE;
 FOR owner IN SELECT DISTINCT merchant_id FROM bb_product WHERE deleted_at IS NULL AND merchant_id IS NOT NULL ORDER BY merchant_id LOOP
  -- Same mutex/order as ProductMarkerService.assign/defaults/save. No global write pause.
  PERFORM id FROM bb_user WHERE id=owner FOR UPDATE;
  SELECT * INTO d FROM bb_product_marker_definition WHERE merchant_id=owner AND code='discount' FOR UPDATE;
  FOR p IN SELECT * FROM bb_product WHERE merchant_id=owner AND deleted_at IS NULL ORDER BY id FOR UPDATE LOOP
   scanned := scanned+1; active := false; unknown := false;
   -- Use retained publication facts, not mutable drafts or another merchant's offers.
   FOR f IN SELECT i.publication_snapshot AS facts FROM bb_recommendation_item i
    JOIN bb_recommendation_post post ON post.id=i.post_id
    WHERE i.product_id=p.id AND post.merchant_id=owner AND post.published
      AND i.publication_state='PUBLISHED' AND i.publication_snapshot IS NOT NULL LOOP
    IF f.facts->>'itemNumber' IS DISTINCT FROM p.item_number THEN
     unknown := true; CONTINUE;
    END IF;
    state := pg_temp.offer_marker_state(f.facts,today);
    active := active OR state='ACTIVE'; unknown := unknown OR state='UNKNOWN';
   END LOOP;
   -- Actual storefront reductions use the same regular price and half-open instants as ProductSaleService.
   BEGIN
   regular := NULL; cur := p.currency; unit_text := '';
   IF p.sale IS NULL THEN
    IF p.base_price > 0 AND p.base_price::text NOT IN ('NaN','Infinity') AND
       p.id NOT LIKE 'bobuy-rec-v1-%' AND COALESCE(p.attributes->>'recommendationProfile','false') <> 'true' THEN regular := p.base_price; END IF;
   ELSIF p.sale->>'enabled'='true' AND p.order_method='PRE_ORDER' AND
     (p.sale->>'validFrom' IS NULL OR (p.sale->>'validFrom')::date<=today) AND
     (p.sale->>'validThrough' IS NULL OR (p.sale->>'validThrough')::date>=today) AND
     COALESCE(btrim(p.sale->>'unit'),'')<>'' THEN
    regular := (p.sale->>'amount')::numeric; cur := p.sale->>'currency'; unit_text := p.sale->>'unit';
   END IF;
   SELECT count(*),min(a.amount) INTO actual_count,actual_amount FROM bb_product_price_adjustment a
    JOIN bb_currency currency ON currency.code=a.currency AND currency.sale_enabled
    WHERE a.product_id=p.id AND a.merchant_id=owner AND a.channel='STOREFRONT' AND a.currency=cur
      AND a.status='APPROVED' AND a.approved_at<=now_at AND a.starts_at<=now_at AND now_at<a.ends_at
      AND regular>0 AND scale(trim_scale(regular))<=currency.fraction_digits;
   IF actual_count>1 THEN unknown := true;
   ELSIF actual_count=1 AND actual_amount<regular THEN active := true; END IF;
   EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR invalid_datetime_format OR numeric_value_out_of_range THEN
    unknown := true;
   END;
   SELECT * INTO s FROM bb_product_marker_set WHERE product_id=p.id FOR UPDATE;
   IF s.product_id IS NOT NULL AND s.merchant_id<>owner THEN RAISE EXCEPTION 'Marker owner mismatch'; END IF;
   old_ids := COALESCE(s.marker_ids,'[]'); new_ids := old_ids;
   IF NOT active AND unknown THEN uncertain := uncertain+1; CONTINUE; END IF;
   IF d.id IS NULL AND active THEN
    INSERT INTO bb_product_marker_definition(id,merchant_id,code,badge,name,description,color,sort_order,enabled,version)
    VALUES(gen_random_uuid()::text,owner,'discount','折','{"ja-JP":"割引","zh-CN":"优惠","zh-TW":"優惠","en-US":"Discount"}',
      '{}','red',10,true,0) RETURNING * INTO d;
    created := created+1;
   END IF;
   IF d.id IS NULL THEN unchanged := unchanged+1; CONTINUE; END IF;
   IF NOT d.enabled THEN disabled := disabled+1; CONTINUE; END IF;
   IF active AND NOT old_ids ? d.id THEN
    IF jsonb_array_length(old_ids)>=50 THEN uncertain := uncertain+1; CONTINUE; END IF;
    new_ids := old_ids || jsonb_build_array(d.id); added := added+1;
   ELSIF NOT active AND old_ids ? d.id THEN
    new_ids := old_ids - d.id; removed := removed+1;
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
