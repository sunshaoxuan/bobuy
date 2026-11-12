"""Pinned Bobuy V32 to V33 operator. No database restore over the live database."""
from pathlib import Path
import argparse,fcntl,hashlib,importlib.util,json,os,re,shutil,subprocess,time
ROOT=Path('/opt/bobuy');STAGE=ROOT/'releases/20261112.3'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def run(*args,input=None,timeout=180):
 p=subprocess.run(args,input=input,text=True,capture_output=True,timeout=timeout)
 if p.returncode:raise RuntimeError('Scoped command failed: '+args[0]+'; sensitive output suppressed')
 return p.stdout.strip()
def load_library(a):
 library=ROOT/'releases/20261111.1/release_operator.py';assert sha(library)==a['librarySha256']
 spec=importlib.util.spec_from_file_location('pinned_release',library);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.STAGE=STAGE
 return m,m.helpers(a)
def mark(phase,**extra):
 value=dict(phase=phase,at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**extra)
 (STAGE/'status.tmp').write_text(json.dumps(value,indent=2));(STAGE/'status.tmp').replace(STAGE/'status.json')
def verify(a):
 assert sha(STAGE/'release-operator.py')==a['operatorSha256']
 g=read(STAGE/'gates.json');assert sha(STAGE/'gates.json')==a['gatesSha256'] and g['source']==a['source'] and g['result']=='PASS'
 assert g['configuredJacoco']=='PASS' and g['backend']['failures']==g['backend']['errors']==0 and g['frontendTests']==773
 assert [i['name'] for i in a['images']]==['core-service','frontend']
 assert a['schemaBefore']=='32' and a['schemaAfter']=='33' and len(a['migrationsAdded'])==1
 assert a['migrationsAdded'][0]['path']=='V33__product_clicks.sql'
 for i in a['images']:
  d=json.loads(run('docker','image','inspect',i['tag']))[0]
  assert d['Id'] in {i['imageId'],i.get('configDigest')} and d['Config']['Labels']['org.opencontainers.image.revision']==a['source']
  assert d['RootFS']['Layers']==i['rootfsDiffIds']
def probe(m,image,db,label):
 """No ingress, no Nacos discovery, no media worker, and only a restored database."""
 assert db=='bobuy_engagement_restore_20261112_3'
 name='bobuy-engagement-probe';assert not subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
 original=json.loads(run('docker','inspect','bobuy-core-service'))[0]
 env=dict(x.split('=',1) for x in original['Config']['Env'] if '=' in x)
 env['SPRING_DATASOURCE_URL']=re.sub(r'/[^/?]+(?:\?.*)?$', '/'+db,env['SPRING_DATASOURCE_URL'])
 env.update(SPRING_CLOUD_NACOS_DISCOVERY_ENABLED='false',SPRING_CLOUD_NACOS_CONFIG_ENABLED='false',SPRING_CLOUD_NACOS_CONFIG_IMPORT_CHECK_ENABLED='false',SPRING_CONFIG_IMPORT='',BOBBUY_SEED_ENABLED='false',BOBBUY_MEDIA_WORKER_ENABLED='false',BOBBUY_WEBSOCKET_BROKER_RELAY_ENABLED='false',BOBBUY_CHAT_REDIS_PUBSUB_ENABLED='false')
 secret=STAGE/'probe.env';secret.write_text('\n'.join(k+'='+v for k,v in env.items())+'\n');secret.chmod(0o600)
 args=['docker','create','--name',name,'--network','bobuy-net','--memory','768m','--env-file',str(secret)]
 for mount in original['Mounts']:
  assert not mount['RW'],'Probe only accepts readonly mounts'
  args+=['-v',mount['Source']+':'+mount['Destination']+':ro']
 try:
  run(*args,image);run('docker','start',name)
  deadline=time.monotonic()+110
  while time.monotonic()<deadline:
   p=subprocess.run(['docker','exec',name,'curl','-fsS','http://127.0.0.1:'+env.get('SERVER_PORT','8081')+'/api/health'],capture_output=True)
   if p.returncode==0:break
   time.sleep(2)
  else:raise RuntimeError(label+' restored-database health failed')
  body=run('docker','exec',name,'curl','-fsS','http://127.0.0.1:'+env.get('SERVER_PORT','8081')+'/api/storefront/product-browse')
  assert json.loads(body)['status']=='success'
  return dict(result='PASS',image=image,jarSha256=run('docker','exec',name,'sha256sum','/app/app.jar').split()[0],java=run('docker','exec',name,'java','--version'),database=db,noPublicPort=True)
 finally:
  subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  secret.unlink(missing_ok=True)
def main():
 p=argparse.ArgumentParser();p.add_argument('action',choices=['prepare','activate']);p.add_argument('--apply-production-window',action='store_true');args=p.parse_args()
 assert args.apply_production_window and os.geteuid()==0 and not ROOT.is_symlink() and not STAGE.is_symlink()
 os.umask(0o077);a=read(STAGE/'artifact.json');m,h=load_library(a)
 with (ROOT/'releases/engagement-global.lock').open('a+') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  if args.action=='prepare':
   assert not (STAGE/'status.json').exists();assert sha(STAGE/'images.tar')==a['archiveSha256']
   before={n:m.state(n) for n in (*m.WRITERS,'frontend',*m.PROTECTED)}
   for n in ('core-service','frontend'):
    assert all(before[n][k]==a['base'][n][k] for k in ('image','tag','revision'))
   assert all(v['health'] in ('healthy','running') for v in before.values()) and m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='32'
   m.media_flags();run('docker','load','-i',str(STAGE/'images.tar'));verify(a)
   for n in ('core-service','frontend'):run('docker','image','inspect',before[n]['tag'])
   run('docker','save','-o',str(STAGE/'recovery-images.tar'),*[before[n]['tag'] for n in ('core-service','frontend')])
   original=(ROOT/'compose.production.yml').read_text();(STAGE/'compose.before.yml').write_text(original);(STAGE/'compose.after.yml').write_text(m.rewrite_images(original,a['images'],before))
   (STAGE/'runtime.before.json').write_text(json.dumps(before,indent=2));(STAGE/'protected-before.json').write_text(run('python3',str(ROOT/'scripts/protected-node-state.py')))
   mark('PREPARED',source=a['source'],recoveryArchiveSha256=sha(STAGE/'recovery-images.tar'));return
  verify(a);assert read(STAGE/'status.json')['phase']=='PREPARED';before=read(STAGE/'runtime.before.json')
  for n,v in before.items():assert m.state(n)==v,'Concurrent runtime change'
  assert (ROOT/'compose.production.yml').read_text()==(STAGE/'compose.before.yml').read_text();m.media_flags()
  nginx=ROOT/'infra/nginx/bobuy.conf';original=nginx.read_text();(STAGE/'nginx.before.conf').write_text(original)
  opened=False;compatible=False;start=time.monotonic();db='bobuy_engagement_restore_20261112_3'
  try:
   mark('FREEZING');nginx.write_text(h.maintenance_config(original));run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload');run('docker','stop',*['bobuy-'+n for n in m.WRITERS])
   baseline=m.frozen_content();expected=h.database_fingerprint();(STAGE/'content.before.json').write_text(json.dumps(baseline,indent=2));(STAGE/'database.before.json').write_text(json.dumps(expected,indent=2))
   dump=STAGE/'database-before.dump'
   with dump.open('wb') as f:
    r=subprocess.run(['docker','exec','bobuy-postgres','sh','-c','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],stdout=f,stderr=subprocess.PIPE,timeout=120);assert r.returncode==0
   run('docker','exec','bobuy-postgres','sh','-c','createdb -U "$POSTGRES_USER" '+db)
   try:
    with dump.open('rb') as f:
     r=subprocess.run(['docker','exec','-i','bobuy-postgres','sh','-c','pg_restore --exit-on-error -U "$POSTGRES_USER" -d '+db],stdin=f,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120);assert r.returncode==0
    h.validate_restored_database(expected,h.database_fingerprint(db))
    candidate=probe(m,a['images'][0]['tag'],db,'Candidate V33')
    assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1',db)=='33'
    migrated=h.database_fingerprint(db)
    for table,value in expected.items():
     if table not in ('flyway_schema_history','columns','indexes','constraints','sequences'):assert migrated[table]==value
    recovery=probe(m,before['core-service']['tag'],db,'Previous V32 on V33')
    compatible=True
    (STAGE/'backup-check.json').write_text(json.dumps(dict(result='PASS',sha256=sha(dump),exactRestoreFingerprint=True,candidate=candidate,previousApplicationOnV33=recovery,liveDatabaseRestoreForbidden=True),indent=2))
   finally:run('docker','exec','bobuy-postgres','sh','-c','dropdb -U "$POSTGRES_USER" '+db)
   mark('BACKUP_VERIFIED');shutil.copyfile(STAGE/'compose.after.yml',ROOT/'compose.production.yml');run(*m.compose(),'config','--quiet')
   run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','core-service');m.wait_health('core-service')
   assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='33'
   assert run('docker','exec','bobuy-core-service','sha256sum','/app/app.jar').split()[0]==a['coreJarSha256']
   assert m.sql('select count(*) from bb_product_click')=='0';assert m.frozen_content(baseline)==baseline
   run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','frontend');m.wait_health('frontend')
   run('docker','start',*['bobuy-'+n for n in m.WRITERS if n!='core-service'])
   for n in m.WRITERS:m.wait_health(n)
   verify(a)
   for i in a['images']:assert m.state(i['name'])['image'] in {i['imageId'],i.get('configDigest')}
   for n in m.PROTECTED:assert m.state(n)==before[n]
   assert json.loads(run('python3',str(ROOT/'scripts/protected-node-state.py')))==read(STAGE/'protected-before.json')
   assert m.frozen_content(baseline)==baseline
   assert time.monotonic()-start<300,'Pre-open five-minute release budget exceeded'
   (STAGE/'content.after.json').write_text(json.dumps(baseline,indent=2))
   opened=True;mark('OPENING_WRITES',databaseRestoreForbidden=True);nginx.write_text(original);run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload')
   mark('WRITES_OPEN',source=a['source'],seconds=round(time.monotonic()-start,2),schema=33,oldContentUnchanged=True,browser='PENDING',databaseRestoreForbidden=True)
  except Exception as e:
   # V33 only adds a table. All application recovery retains the current database.
   if opened:
    mark('FORWARD_RECOVERY_REQUIRED',reason=str(e),databaseRestoreForbidden=True);raise
   schema=m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')
   if schema=='32' or (schema=='33' and compatible):
    shutil.copyfile(STAGE/'compose.before.yml',ROOT/'compose.production.yml');run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','core-service','frontend');run('docker','start',*['bobuy-'+n for n in m.WRITERS if n!='core-service'])
    for n in m.WRITERS:m.wait_health(n)
    nginx.write_text(original);run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload');mark('APPLICATION_ROLLED_BACK',reason=str(e),schemaRetained=schema,databaseRestoreForbidden=True)
   else:mark('MAINTENANCE_FORWARD_FIX_REQUIRED',reason=str(e),databaseRestoreForbidden=True)
   raise
if __name__=='__main__':main()
