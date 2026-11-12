"""Real local PostgreSQL migration, source preservation and replay verification."""
from decimal import Decimal
import hashlib,json,re,subprocess,unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATABASE='bobuy_price_documents_20261112'
CMD=['docker','exec','-i','bobuy-local-postgres-1','psql','-X','-U','bobuy','-d',DATABASE,'-qAt','-v','ON_ERROR_STOP=1']
MIGRATION=ROOT/'backend/src/main/resources/db/migration/V35__price_adjustment_documents.sql'

def sql(text):
 p=subprocess.run(CMD,input=text.encode(),capture_output=True,timeout=90)
 if p.returncode:raise AssertionError(p.stderr.decode(errors='replace')[-2500:])
 return p.stdout.decode().strip()

class PriceDocumentMigrationTest(unittest.TestCase):
 def test_actual_schema_migration_preserves_evidence_and_replays_without_duplicates(self):
  subprocess.run(['docker','exec','bobuy-local-postgres-1','createdb','-U','bobuy',DATABASE],check=True,capture_output=True)
  try:
   files=sorted((ROOT/'backend/src/main/resources/db/migration').glob('V*.sql'),key=lambda p:Decimal(re.match(r'V([0-9._]+)__',p.name)[1].replace('_','.')))
   for path in files:
    if path==MIGRATION:continue
    sql('BEGIN;\n'+path.read_text(encoding='utf-8')+'\nCOMMIT;')
   sql("""INSERT INTO bb_user(id,name,roles) VALUES(880001,'SYNTHETIC DOCUMENT OWNER','["AGENT"]');
INSERT INTO bb_product(id,merchant_id,item_number,order_method,name) VALUES('pd-one',880001,'PD-1','PRE_ORDER','{}'),('pd-unknown',880001,'PD-2','PRE_ORDER','{}');
INSERT INTO bb_recommendation_post(id,merchant_id,title,body,published,published_at,publisher_id,publisher_name) VALUES(880001,880001,'SYNTHETIC SOURCE','SYNTHETIC',true,'2026-11-01T00:00Z',880001,'SYNTHETIC');
INSERT INTO bb_recommendation_item(id,post_id,product_id,name,item_number,reference_price,original_price,discount_amount,price_unit,offer_start,offer_end,image_hash,image_url,publication_state,publication_snapshot,published_at,published_by)
VALUES(880001,880001,'pd-one','SYNTHETIC ONE','PD-1',80,100,20,'1 pack','2026-11-01','2026-11-30',repeat('a',64),'synthetic://one','PUBLISHED',
 '{"version":1,"legacy":true,"itemNumber":"PD-1","referencePrice":80,"originalPrice":100,"discountAmount":20,"priceUnit":"1 pack","offerStart":"2026-11-01","offerEnd":"2026-11-30","offerNotes":"Verified supplier promotion","referenceContext":{"channel":"COSTCO_WAREHOUSE"}}','2026-11-01T00:00Z',880001),
 (880002,880001,'pd-unknown','SYNTHETIC UNKNOWN','PD-2',80,100,20,'1 pack',null,'2026-11-30',repeat('b',64),'synthetic://unknown','PUBLISHED',
 '{"version":1,"legacy":true,"itemNumber":"PD-2","referencePrice":80,"originalPrice":100,"discountAmount":20,"priceUnit":"1 pack","offerStart":null,"offerEnd":"2026-11-30","referenceContext":{"channel":"COSTCO_WAREHOUSE"}}','2026-11-01T00:00Z',880001);""")
   sql("""INSERT INTO bb_product(id,merchant_id,item_number,order_method,name) VALUES('pd-conflict',880001,'PD-C','PRE_ORDER','{}'),('pd-regular',880001,'PD-R','PRE_ORDER','{}');
INSERT INTO bb_product_price_adjustment(merchant_id,product_id,channel,currency,amount,unit,starts_at,ends_at,status,source_note,created_by,created_at,updated_by,updated_at,approved_by,approved_at)
VALUES(880001,'pd-one','STOREFRONT','JPY',75,'1 pack','2026-11-01Z','2026-12-01Z','APPROVED','Synthetic legacy price correction',880001,now(),880001,now(),880001,now());
INSERT INTO bb_recommendation_item(id,post_id,product_id,name,item_number,reference_price,original_price,price_unit,offer_start,offer_end,image_hash,image_url,publication_state,publication_snapshot,published_at,published_by)
SELECT n,880001,'pd-conflict','SYNTHETIC CONFLICT','PD-C',80,100,'1 pack','2026-11-01','2026-11-30',repeat('c',64),'synthetic://conflict','PUBLISHED',
'{"version":1,"legacy":true,"itemNumber":"PD-C","referencePrice":80,"originalPrice":100,"priceUnit":"1 pack","offerStart":"2026-11-01","offerEnd":"2026-11-30","referenceContext":{"channel":"COSTCO_WAREHOUSE"}}','2026-11-01Z',880001 FROM generate_series(880003,880004) n;
INSERT INTO bb_recommendation_item(id,post_id,product_id,name,item_number,reference_price,price_unit,image_hash,image_url)
VALUES(880005,880001,'pd-regular','SYNTHETIC REGULAR','PD-R',100,'1 pack',repeat('d',64),'synthetic://regular');""")
   sql("""INSERT INTO bb_product(id,merchant_id,item_number,order_method,name) VALUES('pd-inferred',880001,'PD-I','PRE_ORDER','{}');
INSERT INTO bb_recommendation_item(id,post_id,product_id,name,item_number,reference_price,discount_amount,price_unit,offer_start,offer_end,image_hash,image_url,publication_state,publication_snapshot,published_at,published_by)
VALUES(880006,880001,'pd-inferred','SYNTHETIC EXPLICIT REDUCTION','PD-I',80,20,'1 pack','2026-11-01','2026-11-30',repeat('e',64),'synthetic://inferred','PUBLISHED',
'{"version":1,"legacy":true,"itemNumber":"PD-I","referencePrice":80,"discountAmount":20,"priceUnit":"1 pack","offerStart":"2026-11-01","offerEnd":"2026-11-30","referenceContext":{"channel":"COSTCO_WAREHOUSE"}}','2026-11-01Z',880001);""")
   sql("""INSERT INTO bb_recommendation_item(id,post_id,product_id,name,item_number,discount_amount,price_unit,image_hash,image_url)
VALUES(880007,880001,'pd-regular','SYNTHETIC DISCOUNT ONLY','PD-R',20,null,repeat('f',64),'synthetic://discount-only'),
(880008,880001,'pd-regular','SYNTHETIC UNIT ONLY','PD-R',null,'per synthetic pack',repeat('0',64),'synthetic://unit-only');""")
   before=sql('select md5(string_agg(publication_snapshot::text,\'|\' order by id)) from bb_recommendation_item')
   text=MIGRATION.read_text(encoding='utf-8');sql('BEGIN;\n'+text+'\nCOMMIT;')
   self.assertEqual(sql('select count(*) from bb_product_price_adjustment'),'9')
   self.assertEqual(sql("select status from bb_product_price_adjustment where source_key='recommendation:880001'"),'APPROVED')
   self.assertEqual(sql("select status from bb_product_price_adjustment where source_key='recommendation:880002'"),'DRAFT')
   self.assertEqual(sql("select count(*) from bb_product_price_adjustment where source_key in ('recommendation:880003','recommendation:880004') and status='DRAFT'"),'2')
   self.assertEqual(sql("select type||':'||status from bb_product_price_adjustment where source_key='recommendation:880005'"),'PERMANENT:DRAFT')
   self.assertEqual(sql("select status||':'||(source_note like '供应商阶段促销%')::text from bb_product_price_adjustment where source_key='recommendation:880006'"),'APPROVED:true')
   self.assertEqual(sql("select before_amount from bb_product_price_adjustment_line where reference_item_id=880006"),'100.0000')
   self.assertEqual(sql("select evidence#>>'{sourcePrice,reduction}' from bb_product_price_adjustment where source_key='recommendation:880007'"),'20.00')
   self.assertEqual(sql("select unit from bb_product_price_adjustment_line where reference_item_id=880008"),'per synthetic pack')
   self.assertEqual(sql("select count(*) from bb_product_price_adjustment where source_key in ('recommendation:880007','recommendation:880008') and status='DRAFT' and starts_at is null"),'2')
   self.assertEqual(sql("select l.amount||':'||d.status from bb_product_price_adjustment_line l join bb_product_price_adjustment d on d.id=l.document_id where d.document_number like 'PC-LEGACY-%'"),'75.0000:APPROVED')
   self.assertEqual(sql("select ends_at at time zone 'Asia/Tokyo' from bb_product_price_adjustment where source_key='recommendation:880001'"),'2026-12-01 00:00:00')
   self.assertEqual(sql("select count(*) from information_schema.columns where table_name='bb_recommendation_item' and column_name in ('offer_start','offer_end','reference_price','original_price','discount_amount','price_unit')"),'0')
   self.assertEqual(sql('select md5(string_agg(publication_snapshot::text,\'|\' order by id)) from bb_recommendation_item'),before)
   fingerprint=sql("select md5(jsonb_agg(to_jsonb(d) order by id)::text) from bb_product_price_adjustment d")
   sql('BEGIN;\n'+text+'\nCOMMIT;')
   self.assertEqual(sql("select md5(jsonb_agg(to_jsonb(d) order by id)::text) from bb_product_price_adjustment d"),fingerprint)
   self.assertEqual(sql('select count(*) from bb_product_price_adjustment_line'),'9')
  finally:
   subprocess.run(['docker','exec','bobuy-local-postgres-1','dropdb','-U','bobuy',DATABASE],check=True,capture_output=True)

if __name__=='__main__':unittest.main()
