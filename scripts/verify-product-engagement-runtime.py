"""Isolated-schema acceptance in the existing local stack, with automatic application restoration.
Never targets production or writes to public. Credentials stay in process memory.
"""
from pathlib import Path
import subprocess,json,os,time,uuid,hashlib,urllib.request,urllib.error,concurrent.futures,bcrypt,re
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/reports/evidence/product-engagement';OUT.mkdir(parents=True,exist_ok=True)
NAME='bobuy-local-backend-1';PG='bobuy-local-postgres-1';SCHEMA='engagement_'+uuid.uuid4().hex[:12]
ORIGIN='http://127.0.0.1:18080'
def run(args,data=None):
 result=subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if result.returncode:raise RuntimeError('Local command failed: '+args[0]+' '+result.stderr.decode(errors='replace')[:700])
 return result.stdout
def sql(statement,database='bobuy'):
 return run(['docker','exec','-i',PG,'psql','-X','-v','ON_ERROR_STOP=1','-U','bobuy','-d',database,'-At'],statement.encode()).decode().strip()
def scoped(statement):return sql('set search_path to '+SCHEMA+';\n'+statement)
def request(path,method='GET',body=None,token=None,expected=200):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(ORIGIN+path,data=json.dumps(body).encode() if body is not None else (b'' if method=='POST' else None),headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,timeout=40) as response:status=response.status;data=response.read()
 except urllib.error.HTTPError as error:status=error.code;data=error.read()
 assert status==expected,(path,status,data[:180])
 return json.loads(data).get('data') if data else None
def fingerprint(schema,database='bobuy'):
 tables=sql("select tablename from pg_tables where schemaname='"+schema+"' and tablename<>'flyway_schema_history' order by tablename",database).splitlines()
 queries=["select '"+table+"',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')),(select md5(jsonb_agg(to_jsonb(c) order by ordinal_position)::text) from information_schema.columns c where table_schema='"+schema+"' and table_name='"+table+"') from "+schema+'."'+table+'" t' for table in tables]
 return {parts[0]:parts[1:] for line in sql(' union all '.join(queries),database).splitlines() if (parts:=line.split('|'))}
original=json.loads(run(['docker','inspect',NAME]))[0]
assert original['Config']['Labels'].get('com.docker.compose.project')=='bobuy-local'
assert len(original['NetworkSettings']['Networks'])==1
network=next(iter(original['NetworkSettings']['Networks']))
original_image=original['Config']['Image']
run(['docker','image','inspect',original_image])
backup=ROOT/'.task-results/original-start.jar';backup.parent.mkdir(exist_ok=True)
run(['docker','cp',NAME+':/app/app.jar',str(backup)])
original_sha=hashlib.sha256(backup.read_bytes()).hexdigest()
original_env=dict(value.split('=',1) for value in original['Config']['Env'] if '=' in value)
protected_db=original_env['SPRING_DATASOURCE_URL'].split('/')[-1].split('?')[0]
assert re.fullmatch('[a-zA-Z0-9_]+',protected_db)
protected_before=fingerprint('public',protected_db)
jar=ROOT/'backend/target/bobbuy-backend-0.1.0.jar';assert jar.is_file()
before=fingerprint('public');report={'environment':'existing bobuy-local, isolated PostgreSQL schema','schema':SCHEMA,'originalJarSha256':original_sha,'originalImage':original_image,'jarSha256':hashlib.sha256(jar.read_bytes()).hexdigest(),'checks':{}}
report['beforePublicFingerprints']=before
report['beforeProtectedFingerprints']=protected_before
running=False
def replace(target=None):
 global running
 if running or target is not None:
  run(['docker','stop',NAME]);run(['docker','rm',NAME]);running=False
 args=['docker','create','--name',NAME,'--network',network,'--network-alias','backend','--workdir',original['Config'].get('WorkingDir') or '/app']
 for env in original['Config']['Env']:args+=['--env',env]
 for bind in original['HostConfig'].get('Binds') or []:args+=['--volume',bind]
 for key,value in original['Config'].get('Labels',{}).items():args+=['--label',key+'='+value]
 entry=original['Config']['Entrypoint'] or [];cmd=original['Config']['Cmd'] or []
 if entry:args+=['--entrypoint',entry[0]];cmd=entry[1:]+cmd
 if target is not None:cmd+=['--spring.datasource.url=jdbc:postgresql://postgres:5432/bobuy?currentSchema='+SCHEMA,'--spring.flyway.schemas='+SCHEMA,'--spring.flyway.default-schema='+SCHEMA,'--spring.jpa.properties.hibernate.default_schema='+SCHEMA,'--spring.flyway.target='+str(target),'--bobbuy.seed.enabled=false','--bobbuy.seed.force-reset-on-invoke=false']
 run(args+[original_image]+cmd)
 run(['docker','cp',str(jar if target is not None else backup),NAME+':/app/app.jar'])
 run(['docker','start',NAME]);running=True
 for attempt in range(60):
  try:request('/api/health');return
  except Exception:time.sleep(1)
 raise RuntimeError('Candidate did not become healthy')
try:
 sql('create schema '+SCHEMA)
 replace(32)
 password=uuid.uuid4().hex;hashed=bcrypt.hashpw(password.encode(),bcrypt.gensalt()).decode()
 scoped("insert into bb_user(id,name,username,password_hash,roles,enabled) values (98733001,'Synthetic QA author','engagement-qa','"+hashed+"','[\"CUSTOMER\",\"AGENT\"]',true),(98733002,'Synthetic QA second','engagement-qa-second','"+hashed+"','[\"CUSTOMER\"]',true);")
 for index in range(30):
  id='engagement-qa-'+str(index).zfill(2)
  name='验收商品 '+str(index).zfill(2)
  gallery=json.dumps([{'url':'/assets/products/matcha-muffins.jpg','type':'IMAGE','visible':True}])
  scoped("insert into bb_product(id,merchant_id,name,description,brand,base_price,visibility_status,media_gallery) values ('"+id+"',98733001,'"+json.dumps({'ja-JP':name,'zh-CN':name},ensure_ascii=False)+"','{}','QA',"+str(index+100)+",'PUBLIC','"+gallery+"');")
 # Legacy snapshots are valid persisted publication-time records; synthetic fixture only.
 scoped("insert into bb_recommendation_post(id,merchant_id,title,body,published,published_at,publisher_id,publisher_name) values(98733001,98733001,'合成验收推荐','仅用于本地商品排序、热度和星级验收。',true,now(),98733001,'Synthetic QA author');")
 for index in range(30):
  scoped("insert into bb_recommendation_item(id,post_id,product_id,name,image_hash,image_url,reference_price,publication_state,published_at,published_by,publication_snapshot) values ("+str(98733000+index)+",98733001,'engagement-qa-"+str(index).zfill(2)+"','验收商品 "+str(index).zfill(2)+"','"+'a'*64+"','/assets/products/matcha-muffins.jpg',"+str(index+100)+",'PUBLISHED',now(),98733001,'{\"version\":1,\"legacy\":true}');")
 scoped("update bb_recommendation_item set publication_snapshot=jsonb_build_object('version',1,'legacy',true,'name',name,'referencePrice',reference_price,'translations','{}'::jsonb,'gallery','[{\"id\":\"qa\",\"url\":\"/assets/products/matcha-muffins.jpg\"}]'::jsonb,'categoryIds','[]'::jsonb);")
 scoped("insert into bb_recommendation_item select (jsonb_populate_record(null::bb_recommendation_item,to_jsonb(i)||'{\"id\":98733999,\"image_hash\":\""+'b'*64+"\"}'::jsonb)).* from bb_recommendation_item i where id=98733000")
 preserved=fingerprint(SCHEMA)
 replace(33)
 after=fingerprint(SCHEMA);assert all(after[k]==v for k,v in preserved.items())
 migration=(ROOT/'backend/src/main/resources/db/migration/V33__product_clicks.sql').read_text()
 scoped(migration);scoped(migration)
 report['checks']['populatedMigrationIdempotentRetainsOldRows']='PASS'
 agent=request('/api/auth/login','POST',{'username':'engagement-qa','password':password})['accessToken']
 customer=request('/api/auth/login','POST',{'username':'engagement-qa-second','password':password})['accessToken']
 id='engagement-qa-00';path='/api/storefront/product-popularity/'+id
 assert int(request(path)['clicks'])==0
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:list(pool.map(lambda _:request(path+'/click','POST'),range(120)))
 assert int(request(path)['clicks'])==120
 report['checks']['concurrent120ClicksNoLoss']='PASS'
 rating='/api/product-reviews/'+id+'/mine'
 request(rating,'PUT',{'stars':5,'comment':'合成验收','version':0},agent)
 request(rating,'PUT',{'stars':2,'comment':'合成验收','version':0},customer)
 summary=request('/api/storefront/product-reviews/'+id);assert summary['average']==3.5 and summary['count']==2
 request(rating,'PUT',{'stars':4,'comment':'改分','version':1},customer)
 summary=request('/api/storefront/product-reviews/'+id);assert summary['average']==4.5 and summary['count']==2
 request(rating,'PUT',{'stars':1,'comment':'stale','version':0},customer,409)
 request(rating,'PUT',{'stars':5,'version':0},None,401)
 request(rating,'PUT',{'stars':0.5,'version':2},customer,400)
 scoped("update bb_recommendation_item set product_id='engagement-qa-01' where id=98733000")
 assert int(request(path)['clicks'])==120 and int(request('/api/storefront/product-popularity/engagement-qa-01')['clicks'])==0
 assert request('/api/storefront/product-reviews/engagement-qa-01')['count']==0
 assert request('/api/storefront/product-reviews/'+id)['count']==2
 scoped("update bb_recommendation_item set product_id='engagement-qa-00' where id=98733000")
 report['checks']['averageEditPermissionsRelinkRetainsOwnership']='PASS'
 scoped("update bb_product set visibility_status='DRAFTER_ONLY' where id='engagement-qa-29';update bb_recommendation_post set published=false where id=98733001")
 request('/api/storefront/product-popularity/engagement-qa-29/click','POST',expected=404)
 scoped("update bb_product set visibility_status='PUBLIC' where id='engagement-qa-29';update bb_recommendation_post set published=true where id=98733001")
 for route in ['/api/storefront/product-browse?merchantId=98733001','/api/storefront/recommendation-browse/items?merchantId=98733001&period=all']:
  desc=request(route+'&sort=price-desc');assert len(desc['items'])==24
  assert (desc['items'][0].get('productId') or desc['items'][0]['item']['productId'])=='engagement-qa-29'
  second=request(route+'&sort=price-desc&page=1&revision='+desc['revision']);assert len(second['items'])==desc['matchedTotal']-24
  heat=request(route+'&sort=heat-desc');assert (heat['items'][0].get('productId') or heat['items'][0]['item']['productId'])==id
  request(path+'/click','POST');request(route+'&sort=heat-desc&page=1&revision='+heat['revision'],expected=409)
  request(route+'&sort=garbage',expected=400)
  scoped("update bb_product set base_price=9999 where id='engagement-qa-00'")
  repriced=request(route+'&sort=price-desc');assert (repriced['items'][0].get('productId') or repriced['items'][0]['item']['productId'])==id
  request(route+'&sort=price-desc&page=1&revision='+desc['revision'],expected=409)
  scoped("update bb_product set base_price=100 where id='engagement-qa-00'")
 report['checks']['globalSortPaginationRevisionAndPrivateNegative']='PASS'
 request('/api/product-reviews/engagement-qa-02/mine','PUT',{'stars':1,'comment':'排序低分样本','version':0},agent)
 for route in ['/api/storefront/product-browse?merchantId=98733001','/api/storefront/recommendation-browse/items?merchantId=98733001&period=all']:
  for direction,first in [('asc','engagement-qa-02'),('desc',id)]:
   ordered=request(route+'&sort=rating-'+direction)['items'];assert (ordered[0].get('productId') or ordered[0]['item']['productId'])==first
 report['checks']['displayedSalePriceAndRatingDirections']='PASS'
 run(['docker','restart',NAME])
 for attempt in range(90):
  try:request('/api/health');break
  except Exception:time.sleep(1)
 assert int(request(path)['clicks'])==122 and request('/api/storefront/product-reviews/'+id)['average']==4.5
 report['checks']['restartPersistence']='PASS'
 scoped("insert into bb_product_click(product_id,clicks) values('engagement-qa-01',9223372036854775806) on conflict(product_id) do update set clicks=excluded.clicks")
 assert request('/api/storefront/product-popularity/engagement-qa-01')['clicks']=='9223372036854775806'
 assert request('/api/storefront/product-popularity/engagement-qa-01/click','POST')['clicks']=='9223372036854775807'
 report['checks']['maximumBigintExactRepresentation']='PASS'
 print('API_DATABASE_PASS READY_FOR_BROWSER',flush=True)
 env=os.environ.copy();env.update(QA_PASSWORD=password,QA_USERNAME='engagement-qa',QA_PRODUCT=id,QA_ORIGIN='http://127.0.0.1:4173')
 while True:
  command=input().strip()
  if command=='stop':break
  if command=='ui':
   result=subprocess.run(['node',str(ROOT/'scripts/verify-product-engagement-ui.mjs')],cwd=ROOT,env=env)
   report['checks']['browserExit']=result.returncode
   print('BROWSER_FINISHED',result.returncode,flush=True)
finally:
 try:
  exists=subprocess.run(['docker','inspect',NAME],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
  if exists:run(['docker','stop',NAME]);run(['docker','rm',NAME]);running=False
  replace(None)
  assert run(['docker','exec',NAME,'sha256sum','/app/app.jar']).decode().split()[0]==original_sha
  assert fingerprint('public')==before
  assert fingerprint('public',protected_db)==protected_before
  report['checks']['originalLocalServiceAndPublicDataRestored']='PASS'
  sql('drop schema '+SCHEMA+' cascade')
 finally:
  (OUT/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
  print('LOCAL_RESTORATION_FINISHED' if report['checks'].get('originalLocalServiceAndPublicDataRestored')=='PASS' else 'LOCAL_RESTORATION_INCOMPLETE',flush=True)
