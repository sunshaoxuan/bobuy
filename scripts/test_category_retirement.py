"""Real PostgreSQL rehearsal, confined to one disposable database in the named test container."""
import importlib.util,json,subprocess,unittest,os,tempfile
from decimal import Decimal
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('retirement',ROOT/'scripts/category_retirement.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
CONTAINER='bobuy-category-retirement-test';DB='category_retirement_synthetic'
CMD=['docker','exec','-i',CONTAINER,'psql','-X','-U','postgres','-d',DB,'-qAt','-v','ON_ERROR_STOP=1']
def sql(value):
    p=subprocess.run(CMD,input=value,text=True,capture_output=True,timeout=60)
    if p.returncode:raise AssertionError(p.stderr[-1800:])
    return p.stdout.strip()
class CategoryRetirementTest(unittest.TestCase):
 def test_explicit_scope_atomic_replay_history_and_guarded_recovery(self):
    subprocess.run(['docker','exec',CONTAINER,'createdb','-U','postgres',DB],check=True,capture_output=True)
    try:
      expected=os.environ.get('CATEGORY_RETIREMENT_TEST_PG_VERSION')
      if expected:self.assertTrue(sql('SHOW server_version').startswith(expected))
      paths=sorted((ROOT/'backend/src/main/resources/db/migration').glob('V*.sql'),key=lambda p:Decimal(p.name[1:].split('__')[0].replace('_','.')))
      for path in paths:sql('BEGIN;\n'+path.read_text()+'\nCOMMIT;')
      sql("""
INSERT INTO bb_user(id,name,roles) VALUES(777001,'SYNTHETIC OWNER','["AGENT"]'),(777002,'SYNTHETIC OTHER','["AGENT"]');
INSERT INTO bb_category(id,name,merchant_id,tag_key) VALUES('syn-old-a','{"ja-JP":"旧分類A"}',777001,'old-a'),('syn-old-b','{"ja-JP":"旧分類B"}',777001,'old-b'),('syn-keep','{"ja-JP":"残す"}',777001,'keep'),('syn-foreign','{}',777002,'foreign');
INSERT INTO bb_category_tree_node(id,name,full_path) VALUES('syn-leaf','{"ja-JP":"新分類"}','["syn-leaf"]');
INSERT INTO bb_category_legacy_mapping VALUES('syn-old-a','syn-leaf');
INSERT INTO bb_product(id,name,merchant_id,item_number,category_id,catalog_data,record_version,deleted_at) VALUES
('syn-active','{"ja-JP":"Synthetic active"}',777001,'S-A','syn-old-a','{"categoryIds":["syn-old-a","syn-keep"],"translatedSource":"unchanged","specification":{}}',7,null),
('syn-deleted','{"ja-JP":"Synthetic deleted"}',777001,'S-D','syn-old-b','{"categoryIds":["syn-old-b"],"specification":{}}',8,'2026-11-01Z'),
('syn-unassigned','{"ja-JP":"Synthetic pending"}',777001,'S-U','syn-old-a','{"categoryIds":["syn-old-a"],"specification":{}}',9,null),
('syn-outside','{"ja-JP":"Outside"}',777002,'S-X','syn-foreign',null,2,null);
UPDATE bb_product SET sale='{"amount":2998,"currency":"JPY","unit":"box","enabled":true,"revision":2,"reviewedBy":777001,"reviewedAt":1795002605.495870245}',
 price_tiers='[{"tierName":"Synthetic precision","price":123.123456789012345678901,"currency":"JPY","agentOnly":false}]' WHERE id='syn-active';
INSERT INTO bb_product_primary_category_path VALUES('syn-active','syn-leaf');
INSERT INTO bb_recommendation_post(id,merchant_id,title,body,published,published_at,publisher_id,publisher_name) VALUES(777001,777001,'Synthetic','Synthetic',true,now(),777001,'Synthetic owner');
INSERT INTO bb_recommendation_item(id,post_id,product_id,name,category_ids,image_hash,image_url,publication_state,published_at,published_by,publication_snapshot)
VALUES(777001,777001,'syn-active','Synthetic history','["syn-old-a"]',repeat('a',64),'synthetic://image','PUBLISHED',now(),777001,'{"version":1,"legacy":true,"categoryIds":["syn-old-a"],"catalog":{"catalogData":{"categoryIds":["syn-old-a"]}}}');
INSERT INTO bb_product_catalog_recovery(id,merchant_id,product_id,version_after,created_at,original)
VALUES('syn-checkpoint',777001,'syn-active',7,now(),'{"categoryId":"syn-old-a","catalogData":{"categoryIds":["syn-old-a"]}}');
INSERT INTO bb_order_header(id,business_id,status,payment_status,delivery_status,lines) VALUES(777001,'SYNTHETIC-ORDER','NEW','UNPAID','PENDING_DELIVERY','[{"skuId":"syn-active","itemName":"Historical item","quantity":3,"purchasedQuantity":1,"unitPrice":2998}]');
""")
      scope=r.validate_scope({'merchantId':777001,'categoryIds':['syn-old-a','syn-old-b']})
      plan=r.capture(CMD,scope);expected=r.changed_state(plan);rev='a'*40
      with tempfile.TemporaryDirectory() as tmp:
        manifest=Path(tmp)/'plan.json';r.private_write(manifest,plan)
        self.assertEqual(manifest.stat().st_mode&0o777,0o600)
        cli=subprocess.run(['python3',str(ROOT/'scripts/category_retirement.py'),'status','--plan',str(manifest),'--psql-command-json',json.dumps(CMD)],text=True,capture_output=True,check=True)
        self.assertEqual(json.loads(cli.stdout)['status'],'NOT_STARTED')
        self.assertTrue(json.loads(cli.stdout)['matchesBefore'])
      active=next(p for p in plan['before']['products'] if p['id']=='syn-active')
      self.assertEqual(active['sale']['reviewedAt'],Decimal('1795002605.495870245'))
      self.assertEqual(active['price_tiers'][0]['price'],Decimal('123.123456789012345678901'))
      self.assertEqual(r.loads(r.canonical(plan)),plan)
      self.assertEqual(len(plan['before']['products']),3)
      self.assertEqual(plan['before']['protected']['orders']['rows'],1)
      self.assertEqual(plan['before']['protected']['items']['rows'],1)
      self.assertEqual(plan['before']['protected']['checkpoints']['rows'],1)
      self.assertEqual(len(plan['before']['mappings']),1)
      with self.assertRaises(ValueError):r.capture(CMD,{'merchantId':777001,'categoryIds':['syn-foreign']})
      with self.assertRaises(ValueError):r.capture(CMD,{'merchantId':777001,'categoryIds':['missing']})
      invalid=r.loads(r.canonical(plan));invalid['before']['products'][0]['name']={}
      with self.assertRaises(ValueError):r.validate_plan(invalid)
      # New references after capture invalidate the whole transaction.
      sql("INSERT INTO bb_product(id,merchant_id,category_id) VALUES('syn-drift',777001,'syn-old-a')")
      with self.assertRaisesRegex(RuntimeError,'captured scope drifted'):r.transact(CMD,plan,'apply',rev)
      self.assertEqual(sql('SELECT count(*) FROM bb_retired_category'),'0');sql("DELETE FROM bb_product WHERE id='syn-drift'")
      # Failure after product updates still rolls back archive, assignments and deletions together.
      sql("CREATE FUNCTION syn_fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'retirement: synthetic deletion failure'; END $$; CREATE TRIGGER syn_fail BEFORE DELETE ON bb_category FOR EACH ROW EXECUTE FUNCTION syn_fail_delete()")
      with self.assertRaisesRegex(RuntimeError,'synthetic deletion failure'):r.transact(CMD,plan,'apply',rev)
      self.assertEqual(sql('SELECT count(*) FROM bb_retired_category'),'0')
      self.assertEqual(r.run_sql(CMD,r.state_query(scope)+';'),plan['before'])
      sql('DROP TRIGGER syn_fail ON bb_category; DROP FUNCTION syn_fail_delete()')
      from concurrent.futures import ThreadPoolExecutor
      with ThreadPoolExecutor(max_workers=2) as executor:
        self.assertEqual([x['result'] for x in executor.map(lambda _:r.transact(CMD,plan,'apply',rev),range(2))],['PASS','PASS'])
      self.assertEqual(sql("SELECT sale->>'reviewedAt' FROM bb_product WHERE id='syn-active'"),'1795002605.495870245')
      self.assertEqual(sql("SELECT price_tiers#>>'{0,price}' FROM bb_product WHERE id='syn-active'"),'123.123456789012345678901')
      current=r.run_sql(CMD,r.state_query(scope,[p['id'] for p in plan['before']['products']])+';');self.assertEqual(current,expected)
      self.assertEqual(sql("SELECT category_id FROM bb_product WHERE id='syn-outside'"),'syn-foreign')
      self.assertEqual(sql("SELECT count(*) FROM bb_product_primary_category_path WHERE product_id='syn-unassigned'"),'0')
      self.assertEqual(sql("SELECT count(*) FROM bb_product WHERE id='syn-deleted' AND deleted_at IS NOT NULL"),'1')
      # Old clients cannot resurrect FK/JSON assignments or the same logical category.
      for statement in ["UPDATE bb_product SET category_id='syn-old-a' WHERE id='syn-active'", "UPDATE bb_product SET catalog_data='{\"categoryIds\":[\"syn-old-a\"]}' WHERE id='syn-active'", "INSERT INTO bb_category(id,name,merchant_id,tag_key) VALUES('syn-recreated','{}',777001,'old-a')"]:
        with self.assertRaisesRegex(AssertionError,'retirement:'):sql(statement)
      # Normal undelete remains possible. Recovery must never overwrite this subsequent business write.
      sql("UPDATE bb_product SET deleted_at=null WHERE id='syn-deleted'")
      with self.assertRaisesRegex(RuntimeError,'recovery scope changed'):r.transact(CMD,plan,'restore',rev)
      sql("UPDATE bb_product SET deleted_at='2026-11-01Z' WHERE id='syn-deleted'")
      sql("UPDATE bb_order_header SET lines='[{\"skuId\":\"syn-active\",\"quantity\":99}]' WHERE id=777001")
      with self.assertRaisesRegex(RuntimeError,'recovery scope changed'):r.transact(CMD,plan,'restore',rev)
      sql("UPDATE bb_order_header SET lines='[{\"skuId\":\"syn-active\",\"itemName\":\"Historical item\",\"quantity\":3,\"purchasedQuantity\":1,\"unitPrice\":2998}]' WHERE id=777001")
      sql("UPDATE bb_retired_category SET name='{}' WHERE id='syn-old-a'")
      with self.assertRaisesRegex(RuntimeError,'archived evidence changed'):r.transact(CMD,plan,'restore',rev)
      sql("UPDATE bb_retired_category SET name=original->'name' WHERE id='syn-old-a'")
      self.assertEqual(r.transact(CMD,plan,'restore',rev)['result'],'PASS')
      self.assertEqual(r.transact(CMD,plan,'restore',rev)['result'],'PASS')
      self.assertEqual(sql("SELECT sale->>'reviewedAt' FROM bb_product WHERE id='syn-active'"),'1795002605.495870245')
      self.assertEqual(sql("SELECT price_tiers#>>'{0,price}' FROM bb_product WHERE id='syn-active'"),'123.123456789012345678901')
      current=r.run_sql(CMD,r.state_query(scope)+';');self.assertEqual(current,plan['before'])
      with self.assertRaisesRegex(RuntimeError,'already restored'):r.transact(CMD,plan,'apply',rev)
    finally:subprocess.run(['docker','exec',CONTAINER,'dropdb','-U','postgres',DB],check=True,capture_output=True)
class ExactJsonTest(unittest.TestCase):
 def test_deep_json_precision_unicode_and_checksum_survive_file_roundtrip(self):
    source='{"层级":[{"nested":{"nanoseconds":1795002605.495870245,"small":0.000000000000000000001,"large":123456789012345678901234567890,"escaped":"引号\\\"与换行\\n"}}],"bool":true,"null":null}'
    value=r.loads(source);self.assertIsInstance(value['层级'][0]['nested']['nanoseconds'],Decimal)
    with tempfile.TemporaryDirectory() as tmp:
      path=Path(tmp)/'exact.json';r.private_write(path,value);loaded=r.loads(path.read_text())
      self.assertEqual(loaded,value);self.assertEqual(r.digest(loaded),r.digest(value))
    for invalid in [float('nan'),1.5,Decimal('Infinity')]:
      with self.assertRaises(ValueError):r.canonical({'nested':[invalid]})
    with self.assertRaises(ValueError):r.loads('{"bad":NaN}')
    with self.assertRaises(ValueError):r.validate_plan({'format':1})
if __name__=='__main__':unittest.main()
