"""Bound V34 to V35 ERP price-document release on the existing Bobuy node."""
from pathlib import Path
import argparse,hashlib,importlib.util,json,os,re,shutil,subprocess,time

ROOT=Path('/opt/bobuy');STAGE=ROOT/'releases/20261112.price-documents.1'
LIBRARY=ROOT/'releases/20261111.1/release_operator.py'
LIBRARY_SHA='5fddec223ef6f1d38402c8a11c1f99877ffc93f9d7d4b5afeb1271752c5610ac'
WRITERS=('core-service','ai-service','im-service','auth-service','gateway-service')
UPDATES=(*WRITERS[:4],'frontend')
NO_RESTORE={'OPENING_WRITES','WRITES_OPEN','VERIFIED','FORWARD_RECOVERY_REQUIRED'}

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read(path):return json.loads(Path(path).read_text())
def run(*args,**kwargs):
 kwargs.setdefault('capture_output',True);kwargs.setdefault('timeout',180)
 p=subprocess.run(args,**kwargs)
 if p.returncode:raise RuntimeError('Controlled release command failed: '+args[0]+'; sensitive output suppressed')
 return p.stdout.decode().strip() if isinstance(p.stdout,bytes) else (p.stdout or '').strip()
def can_restore(phase,verified):return bool(verified) and phase in {'FREEZING','UPGRADING'}
def wait_maintenance():
 deadline=time.monotonic()+10
 while time.monotonic()<deadline:
  if run('curl','--noproxy','*','--resolve','bobuy.cc:443:127.0.0.1','-sS','-o','/dev/null','-w','%{http_code}','https://bobuy.cc/api/storefront/product-browse')=='503':return
  time.sleep(.25)
 raise RuntimeError('Maintenance ingress did not become effective within ten seconds')
def fingerprint_query(table):
 if not re.fullmatch('[A-Za-z_][A-Za-z0-9_]*',table):raise ValueError('Unsafe fingerprint table')
 expression='to_jsonb(t)';join=''
 if table=='bb_product_price_adjustment':expression="CASE WHEN t.source_key LIKE 'recommendation:%' THEN to_jsonb(t)-ARRAY['id','created_at','updated_at'] ELSE to_jsonb(t)-ARRAY['created_at','updated_at'] END"
 if table=='bb_product_price_adjustment_line':
  join=' JOIN bb_product_price_adjustment d ON d.id=t.document_id'
  expression="CASE WHEN d.source_key LIKE 'recommendation:%' THEN to_jsonb(t)-ARRAY['id','document_id']||jsonb_build_object('documentSource',d.source_key,'documentNumber',d.document_number) ELSE to_jsonb(t) END"
 return "select count(*)||':'||md5(coalesce(string_agg(v,chr(10) order by v),'')) from (select md5(("+expression+")::text) as v from \""+table+'\" t'+join+') rows'
def validate(a,g):
 if not re.fullmatch('[0-9a-f]{40}',a.get('source','')) or a.get('release')!='20261112.price-documents.1' or [i['name'] for i in a['images']]!=list(UPDATES):raise ValueError('Exact source and all compatible applications required')
 if g.get('source')!=a['source'] or g.get('result')!='PASS' or g.get('codeql')!='success' or g.get('backendFailures')!=0 or g.get('frontendFailures')!=0 or g.get('migration')!='PASS' or g.get('ui')!='PASS':raise ValueError('Accepted input-bound gates required')
def mark(phase,**values):
 value=dict(phase=phase,at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**values)
 (STAGE/'status.tmp').write_text(json.dumps(value,indent=2));(STAGE/'status.tmp').replace(STAGE/'status.json');print(json.dumps(value),flush=True)
def load(path,name):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def main():
 import fcntl
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','rearm','activate','verify']);parser.add_argument('--apply-production-window',action='store_true');args=parser.parse_args()
 if not args.apply_production_window or os.geteuid()!=0 or ROOT.is_symlink() or STAGE.is_symlink():raise RuntimeError('Explicit original-node production execution required')
 os.umask(0o077);a=read(STAGE/'artifact.json');g=read(STAGE/'gates.json');validate(a,g)
 assert sha(Path(__file__))==a['operatorSha256'] and sha(STAGE/'gates.json')==a['gatesSha256'] and sha(LIBRARY)==LIBRARY_SHA
 assert sha(STAGE/'publisher_helpers.py')==a['helperSha256'] and sha(STAGE/'V35.sql')==a['migrationSha256']
 assert sha(STAGE/'sync-product-offer-markers.sql')==a['sqlSha256'] and sha(STAGE/'sync-product-offer-markers.py')==a['runnerSha256']
 m=load(LIBRARY,'accepted_runtime_library');h=load(STAGE/'publisher_helpers.py','accepted_recovery_helpers')
 def safe_run(*commands,**kwargs):
  kwargs.pop('check',None);kwargs.setdefault('stdout',subprocess.PIPE);kwargs['stderr']=subprocess.PIPE;kwargs.setdefault('timeout',180)
  p=subprocess.run(commands,**kwargs)
  if p.returncode:raise RuntimeError('Verified recovery helper failed; sensitive output suppressed')
  return p
 h.run=safe_run
 def states():return {name:m.state(name) for name in (*WRITERS,'frontend',*m.PROTECTED)}
 def protected():return json.loads(run('python3',str(ROOT/'scripts/protected-node-state.py')))
 def price_fingerprint(database=None):
  tables=m.sql("select tablename from pg_tables where schemaname='public' and tablename<>'flyway_schema_history' order by tablename",database).splitlines();result={}
  for table in tables:
   result[table]=m.sql(fingerprint_query(table),database)
  return result
 def image_checks():
  for image in a['images']:
   d=json.loads(run('docker','image','inspect',image['tag']))[0]
   assert d['Config']['Labels'].get('org.opencontainers.image.revision')==a['source'] and d['RootFS']['Layers']==image['rootfsDiffIds'] and d['Os']=='linux' and d['Architecture']=='amd64'
 def application_checks():
  for image in a['images']:
   name=image['name'];assert m.state(name)['tag']==image['tag'] and m.state(name)['revision']==a['source']
   if name!='frontend':assert run('docker','exec','bobuy-'+name,'sha256sum','/app/app.jar').split()[0]==a['jars'][name]
  paths=sorted(a['frontend']);actual=run('docker','exec','bobuy-frontend','sha256sum',*['/usr/share/nginx/html/'+p for p in paths]).splitlines();assert [v.split()[0] for v in actual]==[a['frontend'][p] for p in paths]
  assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='35';m.media_flags()
 with (STAGE/'operator.lock').open('a+') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  if args.action=='prepare':
   assert not (STAGE/'status.json').exists() and sha(STAGE/'images.tar')==a['archiveSha256']
   before=states();assert all(v['health'] in ('healthy','running') for v in before.values())
   for name,base in a['baseRuntime'].items():assert before[name]['image']==base['image'] and before[name]['revision']==base['revision']
   assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='34'
   assert m.sql('select count(*) from bb_product_price_adjustment')=='0';m.media_flags()
   assert m.sql("select count(*) from bb_recommendation_item where publication_state='PUBLISHED' and published_at is null")=='0'
   assert run('sha256sum',str(ROOT/'compose.production.yml')).split()[0]==a['baseComposeSha256']
   run('docker','load','-i',str(STAGE/'images.tar'));image_checks()
   original=(ROOT/'compose.production.yml').read_text();(STAGE/'compose.before.yml').write_text(original);(STAGE/'compose.after.yml').write_text(m.rewrite_images(original,a['images'],before))
   (STAGE/'runtime.before.json').write_text(json.dumps(before,indent=2));(STAGE/'protected.before.json').write_text(json.dumps(protected(),indent=2))
   mark('PREPARED',source=a['source']);return
  before=read(STAGE/'runtime.before.json');baseline=read(STAGE/'protected.before.json')
  if args.action=='rearm':
   previous=read(STAGE/'status.json');assert previous['phase']=='ROLLED_BACK_BEFORE_OPEN'
   current=states();assert protected()==baseline and sha(ROOT/'compose.production.yml')==a['baseComposeSha256'] and sha(ROOT/'infra/nginx/bobuy.conf')==a['baseNginxSha256']
   for name,base in a['baseRuntime'].items():assert current[name]['image']==base['image'] and current[name]['revision']==base['revision'] and current[name]['health'] in ('healthy','running')
   assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='34'
   assert m.sql('select count(*) from bb_product_price_adjustment')=='0';image_checks()
   record=next((n for n in ('first-attempt.json','second-attempt.json','third-attempt.json') if not (STAGE/n).exists()),None);assert record is not None
   (STAGE/record).write_text(json.dumps(previous,indent=2));(STAGE/'runtime.before.json').write_text(json.dumps(current,indent=2))
   if previous['restored']:
    for filename in ('database-before.dump','snapshot.json','expected-transformed.json','backup-check.json'):
     prefix='attempt3-' if record=='third-attempt.json' else 'attempt2-'
     (STAGE/filename).rename(STAGE/(prefix+filename))
   mark('PREPARED',source=a['source'],previousAttempt=record,freshStoppedWriterBackupRequired=True);return
  if args.action=='verify':
   assert read(STAGE/'status.json')['phase'] in ('WRITES_OPEN','VERIFIED');application_checks();assert protected()==baseline
   assert run('systemctl','is-enabled','bobuy-offer-markers.timer')=='enabled';assert run('systemctl','is-active','bobuy-offer-markers.timer')=='active'
   mark('VERIFIED',source=a['source'],databaseRestoreForbidden=True);return
  assert read(STAGE/'status.json')['phase']=='PREPARED' and states()==before and protected()==baseline
  assert (ROOT/'compose.production.yml').read_text()==(STAGE/'compose.before.yml').read_text();image_checks()
  nginx=ROOT/'infra/nginx/bobuy.conf';original=nginx.read_text();assert hashlib.sha256(original.encode()).hexdigest()==a['baseNginxSha256']
  (STAGE/'nginx.before.conf').write_text(original);shutil.copyfile(ROOT/'scripts/sync-product-offer-markers.sql',STAGE/'markers.before.sql');shutil.copyfile(ROOT/'scripts/sync-product-offer-markers.py',STAGE/'markers.before.py')
  verified=False;upgrade=False;phase='FREEZING';start=time.monotonic();temporary='bobuy_price_documents_restore_20261112'
  try:
   mark(phase,source=a['source']);run('systemctl','disable','--now','bobuy-offer-markers.timer');nginx.write_text(h.maintenance_config(original));run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload')
   wait_maintenance()
   run('docker','stop',*['bobuy-'+n for n in WRITERS]);snapshot=h.database_fingerprint();(STAGE/'snapshot.json').write_text(json.dumps(snapshot,indent=2))
   with (STAGE/'database-before.dump').open('wb') as stream:
    p=subprocess.run(['docker','exec','bobuy-postgres','sh','-c','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],stdout=stream,stderr=subprocess.PIPE,timeout=180);assert p.returncode==0
   run('docker','exec','bobuy-postgres','sh','-c','createdb -U "$POSTGRES_USER" '+temporary)
   try:
    with (STAGE/'database-before.dump').open('rb') as stream:
     p=subprocess.run(['docker','exec','-i','bobuy-postgres','sh','-c','pg_restore --exit-on-error -U "$POSTGRES_USER" -d '+temporary],stdin=stream,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180);assert p.returncode==0
    h.validate_restored_database(snapshot,h.database_fingerprint(temporary));verified=True
    m.sql('BEGIN;'+(STAGE/'V35.sql').read_text()+'COMMIT;',temporary);expected=price_fingerprint(temporary)
    (STAGE/'expected-transformed.json').write_text(json.dumps(expected,indent=2))
   finally:run('docker','exec','bobuy-postgres','sh','-c','dropdb -U "$POSTGRES_USER" '+temporary)
   (STAGE/'backup-check.json').write_text(json.dumps({'restore':'PASS','sha256':sha(STAGE/'database-before.dump'),'temporaryRemoved':True}))
   phase='UPGRADING';mark(phase,source=a['source']);shutil.copyfile(STAGE/'compose.after.yml',ROOT/'compose.production.yml');run(*m.compose(),'config','--quiet');upgrade=True
   run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','core-service');m.wait_health('core-service')
   assert price_fingerprint()==expected
   run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never',*UPDATES[1:])
   for name in UPDATES[1:]:m.wait_health(name)
   run('docker','start','bobuy-gateway-service');m.wait_health('gateway-service')
   application_checks();assert price_fingerprint()==expected and protected()==baseline
   shutil.copyfile(STAGE/'sync-product-offer-markers.sql',ROOT/'scripts/sync-product-offer-markers.sql');shutil.copyfile(STAGE/'sync-product-offer-markers.py',ROOT/'scripts/sync-product-offer-markers.py')
   preview=json.loads(run('python3',str(ROOT/'scripts/sync-product-offer-markers.py'),'--dry-run'));(STAGE/'markers-preview.json').write_text(json.dumps(preview,indent=2))
   run('systemctl','start','bobuy-offer-markers.service');assert run('systemctl','show','bobuy-offer-markers.service','--property=Result','--value')=='success'
   shutil.copyfile('/var/lib/bobuy-offer-markers/latest.json',STAGE/'markers-first.json');run('systemctl','start','bobuy-offer-markers.service');assert run('systemctl','show','bobuy-offer-markers.service','--property=Result','--value')=='success';shutil.copyfile('/var/lib/bobuy-offer-markers/latest.json',STAGE/'markers-repeat.json')
   repeat=read(STAGE/'markers-repeat.json');assert repeat['added']==0 and repeat['removed']==0 and repeat['sqlSha256']==a['sqlSha256']
   changed=price_fingerprint();assert {k:v for k,v in changed.items() if k!='bb_product_marker_set'}=={k:v for k,v in expected.items() if k!='bb_product_marker_set'}
   phase='OPENING_WRITES';mark(phase,source=a['source'],databaseRestoreForbidden=True);nginx.write_text(original);run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload')
   run('systemctl','enable','--now','bobuy-offer-markers.timer');mark('WRITES_OPEN',source=a['source'],seconds=round(time.monotonic()-start,2),databaseRestoreForbidden=True)
  except Exception as error:
   if phase in NO_RESTORE:mark('FORWARD_RECOVERY_REQUIRED',source=a['source'],reason=type(error).__name__,databaseRestoreForbidden=True);raise
   run('systemctl','disable','--now','bobuy-offer-markers.timer')
   if upgrade:
    if not can_restore(phase,verified):raise RuntimeError('Verified stopped-writer recovery is unavailable') from error
    h.restore_database(m.compose(),STAGE/'database-before.dump',snapshot);h.validate_restored_database(snapshot,h.database_fingerprint())
   shutil.copyfile(STAGE/'compose.before.yml',ROOT/'compose.production.yml');shutil.copyfile(STAGE/'markers.before.sql',ROOT/'scripts/sync-product-offer-markers.sql');shutil.copyfile(STAGE/'markers.before.py',ROOT/'scripts/sync-product-offer-markers.py')
   run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never',*UPDATES)
   for name in UPDATES:m.wait_health(name)
   run('docker','start','bobuy-gateway-service');m.wait_health('gateway-service')
   nginx.write_text(original);run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload');mark('ROLLED_BACK_BEFORE_OPEN',source=a['source'],restored=upgrade,reason=type(error).__name__);raise

if __name__=='__main__':main()
