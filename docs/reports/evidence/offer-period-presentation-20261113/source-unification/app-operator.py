"""Scoped core/frontend application switch; schema and business data remain in place."""
from pathlib import Path
import argparse,fcntl,hashlib,importlib.util,json,os,shutil,subprocess,time
ROOT=Path('/opt/bobuy');STAGE=ROOT/'releases/20261113.offer-source-drawer.1'
LIBRARY=ROOT/'releases/20261111.1/release_operator.py'
LIBRARY_SHA='5fddec223ef6f1d38402c8a11c1f99877ffc93f9d7d4b5afeb1271752c5610ac'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def run(*args):
 p=subprocess.run(args,capture_output=True,text=True,timeout=180)
 if p.returncode:raise RuntimeError('Scoped command failed: '+args[0]+'; sensitive output suppressed')
 return p.stdout.strip()
def main():
 p=argparse.ArgumentParser();p.add_argument('action',choices=['prepare','activate','verify']);args=p.parse_args()
 assert os.geteuid()==0 and not ROOT.is_symlink() and not STAGE.is_symlink();os.umask(0o077)
 a=read(STAGE/'artifact.json');g=read(STAGE/'gates.json')
 assert sha(Path(__file__))==a['operatorSha256'] and sha(LIBRARY)==LIBRARY_SHA and sha(STAGE/'gates.json')==a['gatesSha256']
 assert g['source']==a['source'] and g['result']=='PASS' and g['ci']=='success' and g['browser']=='PASS'
 assert a['migrationBinding']['result']=='IDENTICAL' and [i['name'] for i in a['images']]==['core-service','frontend']
 spec=importlib.util.spec_from_file_location('accepted_runtime',LIBRARY);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 names=(*m.WRITERS,'frontend',*m.PROTECTED);updates=('core-service','frontend')
 def states():return {n:m.state(n) for n in names}
 def protected():return json.loads(run('python3',str(ROOT/'scripts/protected-node-state.py')))
 def history():return m.sql('select md5(json_agg(t order by installed_rank)::text) from flyway_schema_history t')
 def mark(phase,**extra):
  value=dict(phase=phase,source=a['source'],at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**extra);(STAGE/'status.json').write_text(json.dumps(value,indent=2));print(json.dumps(value))
 def assets():
  assert run('docker','exec','bobuy-core-service','sha256sum','/app/app.jar').split()[0]==a['coreJarSha256']
  paths=sorted(a['frontend']);actual=run('docker','exec','bobuy-frontend','sha256sum',*['/usr/share/nginx/html/'+p for p in paths]).splitlines()
  assert [line.split()[0] for line in actual]==[a['frontend'][p] for p in paths]
  run('docker','exec','bobuy-frontend','nginx','-t')
 with (ROOT/'releases/engagement-global.lock').open('a+') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  for image in a['images']:
   d=json.loads(run('docker','image','inspect',image['tag']))[0];assert d['Id']==image['imageId'] and d['Config']['Labels']['org.opencontainers.image.revision']==a['source']
  if args.action=='prepare':
   assert not (STAGE/'status.json').exists();before=states()
   assert all(before[n]==a['base'][n] for n in updates) and all(v['health'] in ('running','healthy') for v in before.values())
   assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='35'
   original=(ROOT/'compose.production.yml').read_text();(STAGE/'compose.before.yml').write_text(original);(STAGE/'compose.after.yml').write_text(m.rewrite_images(original,a['images'],before))
   (STAGE/'runtime.before.json').write_text(json.dumps(before,indent=2));(STAGE/'protected.before.json').write_text(json.dumps(protected(),indent=2));(STAGE/'flyway.before.txt').write_text(history())
   for n in updates:run('docker','image','inspect',before[n]['image'])
   mark('PREPARED',schemaOperation=False,updates=updates);return
  before=read(STAGE/'runtime.before.json');baseline=read(STAGE/'protected.before.json')
  if args.action=='activate':
   assert read(STAGE/'status.json')['phase']=='PREPARED' and states()==before and protected()==baseline
   assert (ROOT/'compose.production.yml').read_text()==(STAGE/'compose.before.yml').read_text()
   try:
    shutil.copyfile(STAGE/'compose.after.yml',ROOT/'compose.production.yml');run(*m.compose(),'config','--quiet')
    for n in updates:
     run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never',n);m.wait_health(n)
    assets();assert history()==(STAGE/'flyway.before.txt').read_text()
    for n in names:
     if n not in updates:assert m.state(n)==before[n]
    assert protected()==baseline
   except Exception:
    shutil.copyfile(STAGE/'compose.before.yml',ROOT/'compose.production.yml')
    run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never',*updates)
    for n in updates:m.wait_health(n)
    mark('APPLICATION_ROLLED_BACK',databaseRestore=False);raise
   mark('APPLICATION_LIVE',updates=updates,schemaUnchanged=True,protectedUnchanged=True);return
  assert read(STAGE/'status.json')['phase'] in ('APPLICATION_LIVE','VERIFIED');assets();assert history()==(STAGE/'flyway.before.txt').read_text()
  for image in a['images']:
   value=m.state(image['name']);assert value['image']==image['imageId'] and value['revision']==a['source'] and value['health'] in ('running','healthy')
  for n in names:
   if n not in updates:assert m.state(n)==before[n]
  assert protected()==baseline;mark('VERIFIED',updates=updates,schemaUnchanged=True,protectedUnchanged=True,databaseRestore=False)
if __name__=='__main__':main()
