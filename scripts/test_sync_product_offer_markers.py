"""Actual PostgreSQL reconciliation from ERP documents; source snapshots are never authority."""
import json,subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATABASE='bobuy_offer_marker_probe_20261112'
COMMAND=['docker','exec','-i','bobuy-local-postgres-1','psql','-X','-U','bobuy','-d',DATABASE,'-qAt','-v','ON_ERROR_STOP=1']
SQL=(ROOT/'scripts/sync-product-offer-markers.sql').read_text(encoding='utf-8')
def query(text,check=True):
 p=subprocess.run(COMMAND,input=text.encode(),capture_output=True,timeout=75)
 if check and p.returncode:raise AssertionError(p.stderr.decode(errors='replace'))
 return p.stdout.decode().strip() if check else p
def literal(value):return "'"+json.dumps(value,ensure_ascii=False).replace("'","''")+"'::jsonb"
class PostgresOfferMarkerTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  subprocess.run(['docker','exec','bobuy-local-postgres-1','createdb','-U','bobuy',DATABASE],check=True,capture_output=True)
  query('''CREATE TABLE bb_user(id bigint PRIMARY KEY);
CREATE TABLE bb_product(id varchar(255) PRIMARY KEY,merchant_id bigint,deleted_at timestamptz,item_number text,base_price double precision DEFAULT 0,currency text DEFAULT 'JPY',sale jsonb,attributes jsonb DEFAULT '{}',order_method text DEFAULT 'PRE_ORDER');
CREATE TABLE bb_currency(code text PRIMARY KEY,sale_enabled boolean,fraction_digits int);INSERT INTO bb_currency VALUES('JPY',true,0);
CREATE TABLE bb_product_price_adjustment(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,merchant_id bigint,type text,channel text,currency text,starts_at timestamptz,ends_at timestamptz,status text,approved_at timestamptz,evidence jsonb DEFAULT '{}');
CREATE TABLE bb_product_price_adjustment_line(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,document_id bigint REFERENCES bb_product_price_adjustment(id),product_id text REFERENCES bb_product(id),amount numeric,before_amount numeric,unit text);
CREATE TABLE bb_recommendation_item(publication_snapshot jsonb);''')
  query((ROOT/'backend/src/main/resources/db/migration/V27__explicit_product_markers.sql').read_text(encoding='utf-8'))
 @classmethod
 def tearDownClass(cls):subprocess.run(['docker','exec','bobuy-local-postgres-1','dropdb','-U','bobuy',DATABASE],check=True,capture_output=True)
 def setUp(self):
  query("TRUNCATE bb_product_marker_set,bb_product_marker_definition,bb_product_price_adjustment_line,bb_product_price_adjustment,bb_recommendation_item,bb_product,bb_user RESTART IDENTITY CASCADE;INSERT INTO bb_user VALUES(1),(2)")
 def product(self,id='p',owner=1):query(f"INSERT INTO bb_product(id,merchant_id,item_number) VALUES('{id}',{owner},'{id}')")
 def document(self,id='p',owner=1,kind='PROMOTION',status='APPROVED',amount=80,before=100,start='2026-11-12T15:00:00Z',end='2026-11-13T15:00:00Z',channel='COSTCO_WAREHOUSE'):
  ending='NULL' if end is None else "'"+end+"'"
  number=query(f"INSERT INTO bb_product_price_adjustment(merchant_id,type,channel,currency,starts_at,ends_at,status,approved_at) VALUES({owner},'{kind}','{channel}','JPY','{start}',{ending},'{status}','2020-01-01T00:00Z') RETURNING id")
  query(f"INSERT INTO bb_product_price_adjustment_line(document_id,product_id,amount,before_amount,unit) VALUES({number},'{id}',{amount},{before},'1 pack')")
  return number
 def marker(self,id='p',enabled=True):
  query("INSERT INTO bb_product_marker_definition(id,merchant_id,code,badge,color,enabled) VALUES('discount-1',1,'discount','折','red',"+str(enabled)+") ON CONFLICT DO NOTHING;"+f"INSERT INTO bb_product_marker_set VALUES('{id}',1,'[\"other\",\"discount-1\"]',4)")
 def sync(self,instant='2026-11-12T16:00:00Z'):return json.loads(query(SQL.replace('transaction_timestamp()',f"'{instant}'::timestamptz")))
 def assignments(self):return json.loads(query("SELECT coalesce(jsonb_object_agg(product_id,jsonb_build_object('ids',marker_ids,'version',version)),'{}') FROM bb_product_marker_set"))
 def test_inclusive_start_exclusive_end_and_repeat_execution(self):
  self.product();self.document();self.marker()
  self.assertEqual(self.sync('2026-11-12T15:00:00Z')['unchanged'],1)
  self.assertEqual(self.sync('2026-11-13T14:59:59Z')['unchanged'],1)
  self.assertEqual(self.sync('2026-11-13T15:00:00Z')['removed'],1)
  self.assertEqual(self.assignments()['p'],{'ids':['other'],'version':5})
  self.assertEqual(self.sync('2026-11-13T15:00:01Z')['removed'],0)
 def test_205_products_multiple_owners_and_deleted_exclusion(self):
  query("""INSERT INTO bb_product(id,merchant_id,item_number) SELECT 'p'||n,CASE WHEN n=204 THEN 2 ELSE 1 END,'p'||n FROM generate_series(0,204)n;
INSERT INTO bb_product_price_adjustment(merchant_id,type,channel,currency,starts_at,ends_at,status,approved_at) SELECT n,'PROMOTION','COSTCO_ONLINE','JPY','2026-11-12T15:00Z','2026-11-13T15:00Z','APPROVED','2020-01-01T00:00Z' FROM generate_series(1,2)n;
INSERT INTO bb_product_price_adjustment_line(document_id,product_id,amount,before_amount,unit) SELECT a.id,p.id,80,100,'1 pack' FROM bb_product p JOIN bb_product_price_adjustment a ON a.merchant_id=p.merchant_id;""")
  self.product('deleted');query("UPDATE bb_product SET deleted_at=now() WHERE id='deleted'")
  report=self.sync();self.assertEqual((report['scanned'],report['added'],report['definitionsCreated']),(205,205,2));self.assertEqual(len(self.assignments()),205);self.assertEqual(self.sync()['added'],0)
 def test_no_document_source_snapshot_can_never_activate_or_pin_a_marker(self):
  self.product();self.marker();query("INSERT INTO bb_recommendation_item VALUES "+'('+literal({'version':1,'referencePrice':80,'originalPrice':100,'offerStart':'2020-01-01','offerEnd':'2099-01-01'})+')')
  self.assertEqual(self.sync()['removed'],1);self.assertEqual(self.assignments()['p']['ids'],['other'])
 def test_only_promotion_type_marks_discount(self):
  for kind in ['TEMPORARY','PERMANENT']:
   with self.subTest(kind=kind):
    self.setUp();self.product();self.marker();self.document(kind=kind,end=None if kind=='PERMANENT' else '2026-11-13T15:00:00Z');self.assertEqual(self.sync()['removed'],1)
 def test_draft_cancelled_future_and_non_decreases_do_not_mark(self):
  for parameters in [{'status':'DRAFT'},{'status':'CANCELLED'},{'start':'2026-11-13T00:00:00Z'},{'amount':100},{'amount':120}]:
   with self.subTest(parameters=parameters):
    self.setUp();self.product();self.marker();self.document(**parameters);self.assertEqual(self.sync()['removed'],1)
 def test_latest_permanent_is_the_regular_baseline(self):
  self.product();self.document(amount=80);self.document(kind='PERMANENT',amount=70,end=None)
  self.assertEqual(self.sync()['added'],0)
  query("UPDATE bb_product_price_adjustment_line SET amount=120 WHERE document_id=2")
  self.assertEqual(self.sync()['added'],1)
 def test_storefront_scope_eligibility_and_source_channels_are_independent(self):
  self.product();self.document(channel='STOREFRONT')
  self.assertEqual(self.sync()['added'],0)
  query("UPDATE bb_product SET sale="+literal({'enabled':True,'currency':'JPY','unit':'1 pack','amount':100}))
  self.assertEqual(self.sync()['added'],1)
  query("UPDATE bb_currency SET sale_enabled=false");self.assertEqual(self.sync()['removed'],1)
  self.document(channel='COSTCO_ONLINE');self.assertEqual(self.sync()['added'],1)
 def test_foreign_owner_and_wrong_source_identity_do_not_mark(self):
  self.product();number=self.document(owner=2);self.assertEqual(self.sync()['added'],0)
  query("UPDATE bb_product_price_adjustment SET merchant_id=1,evidence="+literal({'sourceItemNumber':'wrong'})+f" WHERE id={number}")
  self.assertEqual(self.sync()['added'],0)
 def test_overlap_is_reported_without_erasing_an_existing_marker(self):
  self.product();self.marker();self.document();self.document(amount=70)
  self.assertEqual(self.sync()['uncertain'],1);self.assertEqual(self.assignments()['p']['version'],4)
 def test_disabled_definition_and_capacity_preserve_user_settings(self):
  self.product();self.marker(enabled=False);self.document();self.assertEqual(self.sync()['disabled'],1)
  query("UPDATE bb_product_marker_definition SET enabled=true;UPDATE bb_product_marker_set SET marker_ids="+literal([str(n) for n in range(50)]))
  self.assertEqual(self.sync()['uncertain'],1);self.assertEqual(self.assignments()['p']['version'],4)
 def test_owner_mismatch_rolls_back_prior_changes_and_definitions(self):
  self.product('a');self.document('a');self.product('z');query("INSERT INTO bb_product_marker_set VALUES('z',2,'[]',0)")
  self.assertNotEqual(query(SQL,False).returncode,0);self.assertEqual(query('SELECT count(*) FROM bb_product_marker_definition'),'0');self.assertEqual(list(self.assignments()),['z'])
 def test_advisory_mutex_and_admin_lock_timeout_are_atomic(self):
  self.product();self.document()
  for statement in ["SELECT pg_advisory_xact_lock(680021,1)","SELECT id FROM bb_user WHERE id=1 FOR UPDATE"]:
   admin=subprocess.Popen(COMMAND,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   admin.stdin.write(("BEGIN;"+statement+";SELECT 'locked';SELECT pg_sleep(2);COMMIT;\n").encode());admin.stdin.close()
   while admin.stdout.readline().strip()!=b'locked':pass
   result=query(SQL.replace("lock_timeout = '5s'","lock_timeout = '1s'"),False);self.assertNotEqual(result.returncode,0)
   admin.wait(timeout=8);admin.stdout.close();admin.stderr.close();self.assertEqual(self.assignments(),{})
if __name__=='__main__':unittest.main()
