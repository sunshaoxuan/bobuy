"""Real PostgreSQL behavior and concurrency checks, reusing the existing local server."""
import json
import subprocess
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATABASE = 'bobuy_offer_marker_probe_20261112'
COMMAND = ['docker','exec','-i','bobuy-local-postgres-1','psql','-X','-U','bobuy','-d',DATABASE,'-qAt','-v','ON_ERROR_STOP=1']
SQL = (ROOT/'scripts/sync-product-offer-markers.sql').read_text(encoding='utf-8')


def query(sql, check=True):
    result=subprocess.run(COMMAND,input=sql.encode(),capture_output=True,timeout=75)
    if check and result.returncode:
        raise AssertionError(result.stderr.decode(errors='replace'))
    return result.stdout.decode().strip() if check else result


def literal(value):
    return "'"+json.dumps(value,ensure_ascii=False).replace("'","''")+"'::jsonb"


class PostgresOfferMarkerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(['docker','exec','bobuy-local-postgres-1','createdb','-U','bobuy',DATABASE],check=True,capture_output=True)
        query('''CREATE TABLE bb_user(id bigint PRIMARY KEY);
CREATE TABLE bb_product(id varchar(255) PRIMARY KEY,merchant_id bigint,deleted_at timestamptz,
 item_number text,base_price double precision DEFAULT 0,currency text DEFAULT 'JPY',sale jsonb,
 attributes jsonb DEFAULT '{}',order_method text DEFAULT 'PRE_ORDER');
CREATE TABLE bb_recommendation_post(id bigint PRIMARY KEY,merchant_id bigint,published boolean);
CREATE TABLE bb_recommendation_item(id bigint GENERATED ALWAYS AS IDENTITY,post_id bigint,product_id text,
 publication_state text,publication_snapshot jsonb);
CREATE TABLE bb_currency(code text PRIMARY KEY,sale_enabled boolean,fraction_digits int);
INSERT INTO bb_currency VALUES('JPY',true,0);''')
        for name in ('V27__explicit_product_markers.sql','V17__product_price_adjustments.sql'):
            query((ROOT/'backend/src/main/resources/db/migration'/name).read_text(encoding='utf-8'))

    @classmethod
    def tearDownClass(cls):
        subprocess.run(['docker','exec','bobuy-local-postgres-1','dropdb','-U','bobuy',DATABASE],check=True,capture_output=True)

    def setUp(self):
        query('TRUNCATE bb_recommendation_item,bb_recommendation_post,bb_product_price_adjustment,bb_product_marker_set,bb_product_marker_definition,bb_product,bb_user CASCADE;'
              "INSERT INTO bb_user VALUES(1),(2); INSERT INTO bb_recommendation_post VALUES(1,1,true),(2,2,true),(3,1,false);")

    def product(self,id='p',owner=1):
        query(f"INSERT INTO bb_product(id,merchant_id,item_number) VALUES('{id}',{owner},'{id}')")

    def offer(self,id='p',post=1,**fields):
        f={'version':1,'itemNumber':id,'referencePrice':80,'originalPrice':100,
           'offerStart':'2026-11-12','offerEnd':'2026-11-12'}
        f.update(fields)
        query(f"INSERT INTO bb_recommendation_item(post_id,product_id,publication_state,publication_snapshot) VALUES({post},'{id}','PUBLISHED',{literal(f)})")

    def marker(self,id='p',enabled=True):
        query("INSERT INTO bb_product_marker_definition(id,merchant_id,code,badge,color,enabled) VALUES('discount-1',1,'discount','折','red',"+str(enabled)+") ON CONFLICT DO NOTHING;"
              f"INSERT INTO bb_product_marker_set VALUES('{id}',1,'[\"other\",\"discount-1\"]',4)")

    def sync(self, instant='2026-11-12T16:00:00Z'):
        return json.loads(query(SQL.replace('transaction_timestamp()',f"'{instant}'::timestamptz")))

    def assignments(self):
        return json.loads(query("SELECT coalesce(jsonb_object_agg(product_id,jsonb_build_object('ids',marker_ids,'version',version)),'{}') FROM bb_product_marker_set"))

    def test_jst_start_end_and_idempotent_preservation(self):
        self.product();self.offer();self.marker()
        self.assertEqual(self.sync('2026-11-12T14:59:59Z')['unchanged'],1)
        self.assertEqual(self.sync('2026-11-12T15:00:00Z')['removed'],1)
        self.assertEqual(self.assignments()['p'],{'ids':['other'],'version':5})
        self.assertEqual(self.sync()['unchanged'],1)
        self.assertEqual(self.assignments()['p']['version'],5)

    def test_all_products_bootstrap_distinct_owners_and_deleted_exclusion(self):
        query("""INSERT INTO bb_product(id,merchant_id,item_number) SELECT 'p'||n,CASE WHEN n=204 THEN 2 ELSE 1 END,'p'||n FROM generate_series(0,204) n;
INSERT INTO bb_recommendation_item(post_id,product_id,publication_state,publication_snapshot)
 SELECT CASE WHEN n=204 THEN 2 ELSE 1 END,'p'||n,'PUBLISHED',
 jsonb_build_object('version',1,'itemNumber','p'||n,'referencePrice',80,'originalPrice',100,'offerStart','2026-11-12','offerEnd','2026-11-13') FROM generate_series(0,204) n;""")
        self.product('deleted');query("UPDATE bb_product SET deleted_at=now() WHERE id='deleted'")
        report=self.sync()
        self.assertEqual((report['scanned'],report['added'],report['definitionsCreated']),(205,205,2))
        self.assertEqual(len(self.assignments()),205)
        self.assertEqual(self.sync()['added'],0)

    def test_precedence_active_unknown_expired_and_future(self):
        self.product();self.marker();self.offer(offerStart=None,offerEnd='2026-11-20')
        self.offer(offerStart='2026-11-01',offerEnd='2026-11-10')
        self.assertEqual(self.sync()['uncertain'],1)
        self.assertEqual(self.assignments()['p']['version'],4)
        self.offer(offerEnd='2026-11-13')
        self.assertEqual(self.sync()['unchanged'],1)
        query('DELETE FROM bb_recommendation_item');self.offer(offerStart='2026-11-14',offerEnd='2026-11-20')
        self.assertEqual(self.sync()['removed'],1)

    def test_drafts_foreign_owner_identity_and_plain_reference_do_not_activate(self):
        self.product();self.offer(post=2,offerEnd='2026-11-13');self.offer(post=3,offerEnd='2026-11-13')
        self.offer(offerEnd='2026-11-13',originalPrice=80,discountAmount=0)
        self.assertEqual(self.sync()['added'],0)
        self.offer(itemNumber='wrong',offerEnd='2026-11-13')
        self.assertEqual(self.sync()['uncertain'],1)
        self.assertEqual(self.assignments(),{})

    def test_unknown_malformed_dates_numbers_and_inverted_periods_preserve(self):
        for bad in ({'offerStart':'invalid'},{'offerStart':'today'},{'offerEnd':'2026-02-30'},{'referencePrice':'invalid'},
                    {'originalPrice':1},
                    {'referencePrice':'NaN'},{'offerStart':'2026-11-20'},{'offerStart':None,'offerEnd':None}):
            with self.subTest(bad=bad):
                self.setUp();self.product();self.marker();self.offer(**bad)
                self.assertEqual(self.sync()['uncertain'],1)
                self.assertEqual(self.assignments()['p']['version'],4)

    def test_known_expiry_with_unknown_start_and_no_offers_remove(self):
        self.product();self.marker();self.offer(offerStart=None,offerEnd='2026-11-01')
        self.assertEqual(self.sync()['removed'],1)
        query('DELETE FROM bb_recommendation_item');query("UPDATE bb_product_marker_set SET marker_ids='[\"other\",\"discount-1\"]'")
        self.assertEqual(self.sync()['removed'],1)

    def test_activity_inheritance_coupon_dates_are_separate(self):
        self.product();self.offer(offerStart=None,offerEnd=None,couponStart='2020-01-01',couponEnd='2020-01-02',
          referenceContext={'channel':'COSTCO_WAREHOUSE','activityApplies':True,'activityStart':'2026-11-12','activityEnd':'2026-11-13','sourceUrl':'https://www.costco.co.jp/offer','windowEvidence':'verified'})
        self.assertEqual(self.sync()['added'],1)
        self.assertEqual(self.sync()['unchanged'],1)

    def test_disabled_definition_and_assignment_capacity_are_preserved(self):
        self.product();self.marker(enabled=False);self.offer(offerEnd='2026-11-13')
        self.assertEqual(self.sync()['disabled'],1)
        self.assertEqual(self.assignments()['p']['version'],4)
        query("UPDATE bb_product_marker_definition SET enabled=true; UPDATE bb_product_marker_set SET marker_ids="+literal([str(n) for n in range(50)]))
        self.assertEqual(self.sync()['uncertain'],1)

    def test_storefront_half_open_approved_reduction(self):
        self.product();query("UPDATE bb_product SET base_price=100")
        query("""INSERT INTO bb_product_price_adjustment(merchant_id,product_id,channel,currency,amount,starts_at,ends_at,status,source_note,created_by,created_at,updated_by,updated_at,approved_at)
          VALUES(1,'p','STOREFRONT','JPY',80,'2026-11-12T15:00Z','2026-11-13T15:00Z','APPROVED','test',1,now(),1,now(),'2026-11-12T14:00Z')""")
        self.assertEqual(self.sync('2026-11-12T15:00:00Z')['added'],1)
        self.assertEqual(self.sync('2026-11-13T15:00:00Z')['removed'],1)
        self.assertEqual(query('SELECT base_price FROM bb_product'),'100')

    def test_owner_mismatch_rolls_back_every_write(self):
        self.product('a');self.offer('a',offerEnd='2026-11-13');self.product('z')
        query("INSERT INTO bb_product_marker_set VALUES('z',2,'[]',0)")
        result=query(SQL,check=False)
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(query('SELECT count(*) FROM bb_product_marker_definition'),'0')
        self.assertEqual(list(self.assignments()),['z'])

    def test_overlapping_job_rejected_and_admin_mutex_waits_without_lost_tags(self):
        self.product();self.offer(offerEnd='2026-11-13');self.marker()
        lock=subprocess.Popen(COMMAND,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        lock.stdin.write(b"BEGIN; SELECT pg_advisory_xact_lock(680021,1); SELECT 'locked'; SELECT pg_sleep(3); COMMIT;\n");lock.stdin.close()
        while lock.stdout.readline().strip()!=b'locked':pass
        result=query(SQL,check=False);self.assertNotEqual(result.returncode,0);lock.wait(timeout=8)
        lock.stdout.close();lock.stderr.close()
        self.assertEqual(self.assignments()['p']['version'],4)
        admin=subprocess.Popen(COMMAND,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        admin.stdin.write(b"BEGIN; SELECT id FROM bb_user WHERE id=1 FOR UPDATE; SELECT 'locked'; SELECT pg_sleep(1); UPDATE bb_product_marker_set SET marker_ids='[\"manual\",\"discount-1\"]',version=version+1 WHERE product_id='p'; COMMIT;\n");admin.stdin.close()
        while admin.stdout.readline().strip()!=b'locked':pass
        # Repeatable-read may reject a concurrent admin commit. That failure must never overwrite it.
        result=query(SQL,check=False);admin.wait(timeout=8)
        admin.stdout.close();admin.stderr.close()
        self.assertEqual(self.assignments()['p']['ids'],['manual','discount-1'])
        self.assertEqual(self.sync()['unchanged'],1)

    def test_lock_timeout_leaves_every_assignment_unchanged(self):
        self.product();self.offer(offerEnd='2026-11-13')
        admin=subprocess.Popen(COMMAND,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        admin.stdin.write(b"BEGIN; SELECT id FROM bb_user WHERE id=1 FOR UPDATE; SELECT 'locked'; SELECT pg_sleep(2); COMMIT;\n");admin.stdin.close()
        while admin.stdout.readline().strip()!=b'locked':pass
        result=query(SQL.replace("lock_timeout = '5s'","lock_timeout = '1s'"),check=False)
        self.assertNotEqual(result.returncode,0);admin.wait(timeout=8)
        admin.stdout.close();admin.stderr.close()
        self.assertEqual(self.assignments(),{})
        self.assertEqual(query('SELECT count(*) FROM bb_product_marker_definition'),'0')


if __name__=='__main__':
    unittest.main()
