"""Short-lived, explicitly named production QA fixtures. Only owned IDs may be removed."""
from pathlib import Path
import importlib.util,json,os,sys,secrets,crypt
stage=Path('/opt/bobuy/releases/20261112.5');spec=importlib.util.spec_from_file_location('lib',Path('/opt/bobuy/releases/20261111.1/release_operator.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
prefix='engagement-release-20261112-3';owner=98733001;second=98733002;post=98733001
def q(s):return "'"+s.replace("'","''")+"'"
if sys.argv[1]=='setup':
 assert json.loads((stage/'status.json').read_text())['phase']=='WRITES_OPEN'
 assert m.sql("select count(*) from bb_user where id in (98733001,98733002) or username like '"+prefix+"%'")=='0'
 assert m.sql("select count(*) from bb_product where id like '"+prefix+"%'")=='0'
 assert m.sql('select count(*) from bb_recommendation_post where id=98733001')=='0'
 assert m.sql('select count(*) from bb_recommendation_item where id between 98733000 and 98733999')=='0'
 password=secrets.token_hex(24);hashed=crypt.crypt(password,crypt.mksalt(crypt.METHOD_BLOWFISH));assert hashed.startswith('$2')
 credential=stage/'fixture-credentials.json';credential.write_text(json.dumps(dict(password=password,product=prefix+'-00',username=prefix)));credential.chmod(0o600)
 statements=['BEGIN;']
 for id,name,roles in [(owner,prefix,['CUSTOMER','AGENT']),(second,prefix+'-second',['CUSTOMER'])]:
  statements.append(f"insert into bb_user(id,name,username,password_hash,roles,enabled) values ({id},'发布验收临时账户',{q(name)},{q(hashed)},{q(json.dumps(roles))},true);")
 for index in range(3):
  name='【发布验收临时商品】'+str(index).zfill(2);id=prefix+'-'+str(index).zfill(2)
  gallery=json.dumps([dict(url='/assets/products/matcha-muffins.jpg',type='IMAGE',visible=True)])
  statements.append(f"insert into bb_product(id,merchant_id,name,description,brand,base_price,visibility_status,media_gallery) values ({q(id)},{owner},{q(json.dumps({'ja-JP':name,'zh-CN':name},ensure_ascii=False))},'{{}}','QA',{100+index},'PUBLIC',{q(gallery)});")
 statements.append("insert into bb_recommendation_post(id,merchant_id,title,body,published,published_at,publisher_id,publisher_name) values(98733001,98733001,'【发布验收临时推荐】','临时合成数据，验收后清理。',true,now(),98733001,'发布验收临时账户');")
 for index in range(3):
  id=prefix+'-'+str(index).zfill(2)
  snapshot=json.dumps(dict(version=1,legacy=True,name='【发布验收临时商品】'+str(index).zfill(2),referencePrice=100+index,translations={},gallery=[dict(id='qa',url='/assets/products/matcha-muffins.jpg')],categoryIds=[]),ensure_ascii=False)
  statements.append(f"insert into bb_recommendation_item(id,post_id,product_id,name,image_hash,image_url,reference_price,publication_state,published_at,published_by,publication_snapshot) values ({98733000+index},98733001,{q(id)},'发布验收临时商品',{q(str(index)*64)},'/assets/products/matcha-muffins.jpg',{100+index},'PUBLISHED',now(),98733001,{q(snapshot)});")
 statements.append("insert into bb_recommendation_item select (jsonb_populate_record(null::bb_recommendation_item,to_jsonb(i)||'{\"id\":98733999,\"image_hash\":\""+'b'*64+"\"}'::jsonb)).* from bb_recommendation_item i where id=98733000;")
 statements.append("insert into bb_product_click(product_id,clicks) values ("+q(prefix+'-01')+",9223372036854775807);COMMIT;")
 m.sql('\n'.join(statements));print('FIXTURES_CREATED_ONLY_OWNED_IDS')
elif sys.argv[1]=='cleanup':
 assert m.sql("select count(*) from bb_user where id=98733001 and username="+q(prefix))=='1'
 assert m.sql("select count(*) from bb_product where merchant_id=98733001 and id not like '"+prefix+"%'")=='0'
 assert m.sql('select count(*) from bb_order_header where customer_id in (98733001,98733002)')=='0'
 # Discover actual foreign keys so cleanup cannot touch an unrelated principal's rows.
 rows=m.sql("select table_name,column_name from information_schema.columns where table_schema='public' and table_name like 'bb_%' and (column_name in ('user_id','customer_id','merchant_id','author_id') or table_name='bb_product_review') order by table_name,column_name")
 (stage/'fixture-cleanup-columns.txt').write_text(rows)
 # Known auth/session and review tables are constrained to the two QA principals.
 sql="BEGIN; delete from bb_product_review where product_id like '"+prefix+"%'; delete from bb_product_click where product_id like '"+prefix+"%'; delete from bb_recommendation_item where post_id=98733001; delete from bb_recommendation_post where id=98733001; delete from bb_product where merchant_id=98733001 and id like '"+prefix+"%';"
 for table in m.sql("select tablename from pg_tables where schemaname='public' and tablename in ('bb_refresh_token_session')").splitlines():
  sql+='delete from '+m.identifier(table)+' where user_id in (98733001,98733002);'
 sql+='delete from bb_user where id in (98733001,98733002); COMMIT;';m.sql(sql)
 assert m.sql("select count(*) from bb_product where id like '"+prefix+"%'")=='0'
 assert m.sql('select count(*) from bb_user where id in (98733001,98733002)')=='0'
 (stage/'fixture-credentials.json').unlink(missing_ok=True);(stage/'fixture-cleanup.json').write_text(json.dumps(dict(result='PASS',ownedPrefix=prefix,customerOrdersCreated=0)))
 print('FIXTURES_REMOVED_ONLY_OWNED_IDS')
else:raise ValueError('setup or cleanup')
