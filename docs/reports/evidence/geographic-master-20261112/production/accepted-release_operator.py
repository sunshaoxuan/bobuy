"""Bobuy-only V22->V24 release preparation. Never performs content operations.

Local plan/tests are safe. Server mutations require an explicit future
--apply-production-window flag and the existing Linux /opt/bobuy host context.
"""
from pathlib import Path
import argparse,hashlib,importlib.util,json,os,re,shutil,subprocess,sys,time

SOURCE='eb43b4868fa214f8dc68feb39ab083bf7b3df42e'
BASE='d77fe7759a22f64f311ddf575a7a4f647fe184ea'
RELEASE='20261111.1'
ROOT=Path('/opt/bobuy');STAGE=ROOT/'releases'/RELEASE
BASE_REVISIONS={'core-service':'48433bd7c9bd60b1f77d46a572800d38d0ef0a7a','frontend':'a16af01e308521fa54e7c4df8d18e1567e5ec1fe'}
UPDATES=('core-service','frontend')
WRITERS=('core-service','ai-service','im-service','auth-service','gateway-service')
PROTECTED=('postgres','rustfs','gateway','redis','nacos','rabbitmq')
PHASES_NO_DATABASE_ROLLBACK={'OPENING_WRITES','WRITES_OPEN','FORWARD_RECOVERY_REQUIRED'}

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def run(*args,input=None):
 p=subprocess.run(args,input=input,text=True,capture_output=True)
 if p.returncode:raise RuntimeError('Command failed: '+args[0]+' (exit '+str(p.returncode)+'); no sensitive output emitted')
 return p.stdout.strip()
def compose():return ['docker','compose','--env-file','/etc/bobuy.env','-p','bobuy','-f',str(ROOT/'docker-compose.yml'),'-f',str(ROOT/'compose.production.yml')]
def identifier(value):
 if not re.fullmatch('[A-Za-z_][A-Za-z0-9_]*',value):raise ValueError('Unsafe SQL identifier')
 return '"'+value+'"'
def sql(query,database=None):
 target='"$POSTGRES_DB"' if database is None else identifier(database)
 return run('docker','exec','-i','bobuy-postgres','sh','-c','psql -U "$POSTGRES_USER" -d '+target+' -X -qAt -v ON_ERROR_STOP=1',input=query)
def state(name):
 v=json.loads(run('docker','inspect','bobuy-'+name))[0]
 value={'id':v['Id'],'image':v['Image'],'tag':v['Config']['Image'],'revision':v['Config'].get('Labels',{}).get('org.opencontainers.image.revision'),'project':v['Config'].get('Labels',{}).get('com.docker.compose.project'),'startedAt':v['State']['StartedAt'],'health':v['State'].get('Health',{}).get('Status',v['State']['Status'])}
 if value['project']!='bobuy':raise RuntimeError('Wrong container project')
 return value
def media_flags():
 keys=('BOBBUY_MEDIA_RUSTFS_ENABLED','BOBBUY_MEDIA_PREFER_OBJECT','BOBBUY_MEDIA_OBJECT_ONLY_WRITES')
 for service in ('core-service','ai-service'):
  for key in keys:
   if run('docker','exec','bobuy-'+service,'printenv',key).lower()!='true':raise RuntimeError('Object-only storage gate changed: '+service+'/'+key)
def validate_artifact(value):
 if value.get('source')!=SOURCE or value.get('release')!=RELEASE:raise ValueError('Candidate binding mismatch')
 if [i.get('name') for i in value.get('images',[])]!=list(UPDATES):raise ValueError('Only core/frontend image updates are allowed')
 for image in value['images']:
  expected=('bobuy/core:' if image['name']=='core-service' else 'bobuy/frontend:')+RELEASE
  if image.get('tag')!=expected or not re.fullmatch('sha256:[0-9a-f]{64}',image.get('imageId','')):raise ValueError('Invalid image binding')
 if set(value.get('migrationSha256',{}))!={'28.2','29','30','31','32'}:raise ValueError('All five reviewed migrations required')
 return value

def accepted_image_ids(image):
 # Containerd stores the OCI index ID; classic Docker can expose the exact
 # platform manifest or config ID after load. All are archive-verified bindings.
 values=[image['imageId'],image.get('platformManifestDigest'),image.get('configDigest')]
 return {value for value in values if value and re.fullmatch('sha256:[0-9a-f]{64}',value)}

def verify_loaded_image(image):
 value=json.loads(run('docker','image','inspect',image['tag']))[0]
 if value['Id'] not in accepted_image_ids(image) or value['Config']['Labels']['org.opencontainers.image.revision']!=SOURCE:raise RuntimeError('Loaded image binding mismatch')
 if not image.get('rootfsDiffIds') or value['RootFS']['Layers']!=image['rootfsDiffIds']:raise RuntimeError('Loaded image filesystem differs from verified archive')
def rewrite_images(text,images,before):
 result=text
 for image in images:
  pattern=r'(?ms)(^  '+re.escape(image['name'])+r':\n)(.*?)(?=^  [A-Za-z0-9_-]+:|\Z)'
  matches=list(re.finditer(pattern,result))
  if len(matches)!=1:raise ValueError('Unique service block required')
  match=matches[0];old=before[image['name']]['tag']
  rows=re.findall(r'(?m)^    image:\s*(.*?)\s*$',match.group(2))
  if rows!=[old]:raise ValueError('Running image/config drift; re-review preparation')
  block,count=re.subn(r'(?m)^    image:.*$','    image: '+image['tag'],match.group(2))
  if count!=1:raise ValueError('Unexpected image configuration')
  result=result[:match.start(2)]+block+result[match.end(2):]
 return result
def frozen_content(before=None):
 tables=list(before) if before is not None else sql("select tablename from pg_tables where schemaname='public' and tablename<>'flyway_schema_history' order by tablename").splitlines()
 result={}
 for table in tables:
  columns=before[table]['columns'] if before is not None else sql("select column_name from information_schema.columns where table_schema='public' and table_name='"+table.replace("'","''")+"' order by ordinal_position").splitlines()
  selected=','.join(identifier(c) for c in columns)
  fingerprint=sql("select count(*)||':'||md5(coalesce(string_agg(v,chr(10) order by v),'')) from (select row_to_json(t)::text v from (select "+selected+' from '+identifier(table)+') t) rows')
  result[table]={'columns':columns,'fingerprint':fingerprint}
 return result
def rollback_allowed(phase,unchanged,backup_verified):return phase not in PHASES_NO_DATABASE_ROLLBACK and unchanged and backup_verified
def mark(phase,**values):
 payload={'phase':phase,'source':SOURCE,'release':RELEASE,'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**values}
 target=STAGE/'status.json';temp=STAGE/'status.tmp';temp.write_text(json.dumps(payload,indent=2));temp.replace(target)
def helpers(artifact):
 path=STAGE/'publisher_helpers.py'
 if sha(path)!=artifact['helperSha256']:raise RuntimeError('Publisher helper hash mismatch')
 spec=importlib.util.spec_from_file_location('bobuy_release_helpers',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 def guarded_run(*args,**kwargs):
  kwargs.pop('check',None);kwargs.setdefault('stdout',subprocess.PIPE);kwargs['stderr']=subprocess.PIPE
  result=subprocess.run(args,**kwargs)
  if result.returncode:raise RuntimeError('Verified recovery command failed; no sensitive output emitted')
  return result
 module.run=guarded_run
 return module
def wait_health(name,seconds=140,expected=None):
 deadline=time.monotonic()+seconds
 while time.monotonic()<deadline:
  current=state(name)
  target=expected or ('running' if name=='frontend' else 'healthy')
  if current['health']==target:return current
  time.sleep(2)
 raise RuntimeError('Health deadline: '+name)
def host_guard(approved):
 if not approved:raise RuntimeError('Production window is not enabled by default')
 if not sys.platform.startswith('linux') or os.geteuid()!=0 or not (ROOT/'docker-compose.yml').is_file() or ROOT.is_symlink() or STAGE.is_symlink():raise RuntimeError('Original Bobuy Linux host context required')
def verify_ci():
 # Hosted BOBBuy CI was removed on the accepted main baseline. Bind real local gates.
 a=json.loads((STAGE/'artifact.json').read_text())
 g=json.loads((STAGE/'accepted-gates.json').read_text())
 if sha(STAGE/'accepted-gates.json')!=a['gatesSha256'] or g['source']!=SOURCE or g['frontendTests']!=750 or g['backendTests']!=644 or g['failures']!=0 or g['configuredJacoco']!='PASS':raise RuntimeError('Accepted input-bound local gates missing')
def dump_database(path):
 with path.open('wb') as stream:
  p=subprocess.run(['docker','exec','bobuy-postgres','sh','-c','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],stdout=stream,stderr=subprocess.PIPE)
  if p.returncode:raise RuntimeError('Fresh database backup failed; no sensitive output emitted')
def prepare():
 artifact=validate_artifact(json.loads((STAGE/'artifact.json').read_text()));verify_ci()
 if (STAGE/'status.json').exists():raise RuntimeError('Existing receipt: inspect, do not repeat')
 if sha(STAGE/'images.tar')!=artifact['archiveSha256']:raise RuntimeError('Archive hash mismatch')
 if sha(STAGE/'release_operator.py')!=artifact['operatorSha256']:raise RuntimeError('Operator hash mismatch')
 helpers(artifact)
 dr=run('python3',str(ROOT/'scripts/protected-node-state.py'));(STAGE/'protected-before.json').write_text(dr)
 before={name:state(name) for name in (*WRITERS,'frontend',*PROTECTED)}
 if any(value['health'] not in ('healthy','running') for value in before.values()):raise RuntimeError('Production is not healthy before preparation')
 for name in UPDATES:
  if before[name]['revision']!=BASE_REVISIONS[name]:raise RuntimeError('Production base changed: '+name)
 if sql('show server_version')!='18.6' or sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')!='28.1':raise RuntimeError('Expected production PG18.6/V28.1 changed')
 media_flags()
 database_bytes=int(sql('select pg_database_size(current_database())'))
 if shutil.disk_usage(ROOT).free<max(2*artifact['archiveBytes']+3*database_bytes+1024**3,3*1024**3):raise RuntimeError('Insufficient staging and backup headroom')
 original=(ROOT/'compose.production.yml').read_text();after=rewrite_images(original,artifact['images'],before)
 (STAGE/'compose.before.yml').write_text(original);(STAGE/'compose.after.yml').write_text(after)
 (STAGE/'runtime.before.json').write_text(json.dumps(before,indent=2))
 run('docker','load','-i',str(STAGE/'images.tar'))
 for image in artifact['images']:
  verify_loaded_image(image)
 for name in UPDATES:
  if json.loads(run('docker','image','inspect',before[name]['image']))[0]['Id']!=before[name]['image']:raise RuntimeError('Rollback image absent')
 mark('PREPARED',configBefore=sha(ROOT/'compose.production.yml'),productionActivated=False)
def activate():
 receipt=json.loads((STAGE/'status.json').read_text())
 if receipt['phase']!='PREPARED' or receipt['configBefore']!=sha(ROOT/'compose.production.yml'):raise RuntimeError('Preparation changed or already activated')
 artifact=validate_artifact(json.loads((STAGE/'artifact.json').read_text()));verify_ci();m=helpers(artifact);before=json.loads((STAGE/'runtime.before.json').read_text())
 for name,value in before.items():
  if state(name)!=value:raise RuntimeError('Concurrent runtime change: '+name)
 media_flags();nginx=ROOT/'infra/nginx/bobuy.conf';original=nginx.read_text();(STAGE/'nginx.before.conf').write_text(original)
 phase='FREEZING';backup_verified=False;migration_started=False;database_restored=False;baseline=None;expected=None;start=time.monotonic()
 try:
  mark(phase);nginx.write_text(m.maintenance_config(original));run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload')
  run('docker','stop',*['bobuy-'+name for name in WRITERS]);baseline=frozen_content();(STAGE/'content.before.json').write_text(json.dumps(baseline,indent=2));expected=m.database_fingerprint();(STAGE/'database.before.json').write_text(json.dumps(expected,indent=2));dump=STAGE/'database-before.dump';dump_database(dump)
  db='bobuy_release_restore_'+RELEASE.replace('.','_');run('docker','exec','bobuy-postgres','sh','-c','createdb -U "$POSTGRES_USER" '+db)
  try:
   with dump.open('rb') as stream:
    p=subprocess.run(['docker','exec','-i','bobuy-postgres','sh','-c','pg_restore --exit-on-error -U "$POSTGRES_USER" -d '+db],stdin=stream,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode:raise RuntimeError('Restore rehearsal failed; no sensitive output emitted')
   m.validate_restored_database(expected,m.database_fingerprint(db));backup_verified=True
  finally:run('docker','exec','bobuy-postgres','sh','-c','dropdb -U "$POSTGRES_USER" '+db)
  phase='BACKUP_VERIFIED';mark(phase,backupSha256=sha(dump));shutil.copyfile(STAGE/'compose.after.yml',ROOT/'compose.production.yml');run(*compose(),'config','--quiet')
  migration_started=True
  run(*compose(),'up','-d','--no-deps','--no-build','--pull','never','core-service');wait_health('core-service')
  if sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')!='32':raise RuntimeError('Flyway V32 not established')
  phase='MIGRATED';mark(phase)
  run('docker','start',*['bobuy-'+name for name in WRITERS if name!='core-service'])
  for name in WRITERS:wait_health(name,expected=before[name]['health'])
  run(*compose(),'up','-d','--no-deps','--no-build','--pull','never','frontend');wait_health('frontend');run('docker','exec','bobuy-frontend','nginx','-t')
  for image in artifact['images']:
   current=state(image['name'])
   verify_loaded_image(image)
   if current['image'] not in accepted_image_ids(image) or current['revision']!=SOURCE:raise RuntimeError('Activated image mismatch')
  for name in PROTECTED:
   if state(name)!=before[name]:raise RuntimeError('Protected Bobuy resource changed: '+name)
  for name in WRITERS[1:]:
   current=state(name)
   if any(current[key]!=before[name][key] for key in ('image','tag','revision','project')):raise RuntimeError('Unapproved writer image/config changed: '+name)
  media_flags();actual=frozen_content(baseline)
  if actual!=baseline:raise RuntimeError('Business data changed under freeze; preserve and investigate')
  if time.monotonic()-start>300:raise RuntimeError('Five-minute pre-open deadline exceeded')
  (STAGE/'content.after.json').write_text(json.dumps(actual,indent=2))
  # Persist this boundary BEFORE reload: an uncertain reload must never trigger
  # automatic restoration over newly accepted business writes.
  if json.loads(run('python3',str(ROOT/'scripts/protected-node-state.py')))!=json.loads((STAGE/'protected-before.json').read_text()):raise RuntimeError('Protected DR state changed')
  phase='OPENING_WRITES';mark(phase,backupSha256=sha(dump));nginx.write_text(original);run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload');phase='WRITES_OPEN';mark(phase,seconds=round(time.monotonic()-start,2),databaseVersion=32,imagesUpdated=list(UPDATES),contentUnchanged=True,publicBrowserAcceptance='PENDING')
 except Exception as error:
  try:unchanged=baseline is None or frozen_content(baseline)==baseline
  except Exception:unchanged=False
  if phase in PHASES_NO_DATABASE_ROLLBACK or not unchanged:
   contained=False
   try:
    nginx.write_text(m.maintenance_config(original));run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload');run('docker','stop',*['bobuy-'+name for name in WRITERS]);contained=True
   except Exception:pass
   mark('FORWARD_RECOVERY_REQUIRED',reason=str(error),databaseRestoreForbidden=True,writeFreezeReestablished=contained);raise
  if migration_started and backup_verified and expected is not None:
   if not rollback_allowed(phase,unchanged,backup_verified):raise RuntimeError('Database rollback guard rejected') from error
   run('docker','stop',*['bobuy-'+name for name in WRITERS]);m.restore_database(compose(),STAGE/'database-before.dump',expected);m.validate_restored_database(expected,m.database_fingerprint());database_restored=True
  shutil.copyfile(STAGE/'compose.before.yml',ROOT/'compose.production.yml');run(*compose(),'up','-d','--no-deps','--no-build','--pull','never',*UPDATES);run('docker','start',*['bobuy-'+name for name in WRITERS if name!='core-service'])
  for name in WRITERS:wait_health(name,expected=before[name]['health'])
  for name in UPDATES:
   if state(name)['image']!=before[name]['image']:raise RuntimeError('Rollback image verification failed')
  nginx.write_text(original);run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload');mark('ROLLED_BACK_BEFORE_WRITES',reason=str(error),backupRestored=database_restored);raise
def plan():return {'source':SOURCE,'base':BASE,'release':RELEASE,'imagesUpdated':list(UPDATES),'schema':'V28.1 -> V28.2 -> V29 -> V30 -> V31 -> V32','temporaryWriterPause':list(WRITERS),'databaseEngineUnchanged':'18.6','rustfsUnchanged':'1.0.4','expectedFreezeSeconds':300,'contingencyWindowSeconds':600,'productionActivated':False,'contentOperations':False}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['plan','prepare','activate']);parser.add_argument('--apply-production-window',action='store_true');args=parser.parse_args()
 if args.action=='plan':print(json.dumps(plan(),indent=2));return
 host_guard(args.apply_production_window);os.umask(0o077)
 import fcntl
 with (STAGE/'operator.lock').open('w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);{'prepare':prepare,'activate':activate}[args.action]()
if __name__=='__main__':main()
