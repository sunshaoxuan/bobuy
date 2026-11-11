"""Core-only application repair on V32. No database restore path exists here."""
from pathlib import Path
import argparse,fcntl,hashlib,importlib.util,json,os,shutil,subprocess,time
ROOT=Path('/opt/bobuy');STAGE=ROOT/'releases/20261111.4'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def run(*args):
 r=subprocess.run(args,text=True,capture_output=True,timeout=150)
 if r.returncode:raise RuntimeError('Controlled command failed: '+args[0]+'; sensitive output suppressed')
 return r.stdout.strip()
def mark(phase,**values):
 v=dict(phase=phase,at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**values)
 p=STAGE/'status.tmp';p.write_text(json.dumps(v,indent=2));p.replace(STAGE/'status.json')
def main():
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','activate']);parser.add_argument('--apply-production-window',action='store_true');args=parser.parse_args()
 assert args.apply_production_window and os.geteuid()==0 and not ROOT.is_symlink() and not STAGE.is_symlink()
 os.umask(0o077);a=read(STAGE/'artifact.json');assert sha(STAGE/'image_operator.py')==a['operatorSha256']
 library=ROOT/'releases/20261111.1/release_operator.py';assert sha(library)==a['librarySha256']
 spec=importlib.util.spec_from_file_location('accepted_release_library',library);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.STAGE=STAGE
 h=m.helpers(a)
 with (STAGE/'operator.lock').open('a+') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  image=a['images'][0];assert image['name']=='core-service' and len(a['images'])==1
  v=json.loads(run('docker','image','inspect',image['tag']))[0]
  assert v['Id']==image['imageId'] and v['Config']['Labels']['org.opencontainers.image.revision']==a['source']
  if args.action=='prepare':
   assert not (STAGE/'status.json').exists()
   before={n:m.state(n) for n in (*m.WRITERS,'frontend',*m.PROTECTED)}
   assert before['core-service']['revision']=='8bfb479e520c391e6ab1485e87be4ce55c9dca3e' and before['frontend']['revision']=='8bfb479e520c391e6ab1485e87be4ce55c9dca3e'
   assert all(v['health'] in ('healthy','running') for v in before.values())
   assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='32'
   m.media_flags();original=(ROOT/'compose.production.yml').read_text();after=m.rewrite_images(original,a['images'],before)
   (STAGE/'compose.before.yml').write_text(original);(STAGE/'compose.after.yml').write_text(after);(STAGE/'runtime.before.json').write_text(json.dumps(before,indent=2))
   (STAGE/'protected-before.json').write_text(run('python3',str(ROOT/'scripts/protected-node-state.py')))
   mark('PREPARED',source=a['source'],schema=32,sqlMigration=False);return
  assert read(STAGE/'status.json')['phase']=='PREPARED'
  before=read(STAGE/'runtime.before.json')
  for n,state in before.items():assert m.state(n)==state,'Concurrent runtime change'
  assert (ROOT/'compose.production.yml').read_text()==(STAGE/'compose.before.yml').read_text()
  nginx=ROOT/'infra/nginx/bobuy.conf';original=nginx.read_text();(STAGE/'nginx.before.conf').write_text(original)
  opened=False;phase='FREEZING';start=time.monotonic()
  try:
   mark(phase,source=a['source']);nginx.write_text(h.maintenance_config(original));run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload')
   run('docker','stop',*['bobuy-'+n for n in m.WRITERS]);baseline=m.frozen_content();(STAGE/'content.before.json').write_text(json.dumps(baseline,indent=2))
   history=m.sql('select md5(json_agg(t order by installed_rank)::text) from flyway_schema_history t')
   with (STAGE/'database-before.dump').open('wb') as stream:
    r=subprocess.run(['docker','exec','bobuy-postgres','sh','-c','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],stdout=stream,stderr=subprocess.PIPE,timeout=120);assert r.returncode==0
   with (STAGE/'database-before.dump').open('rb') as stream:
    r=subprocess.run(['docker','exec','-i','bobuy-postgres','pg_restore','--list'],stdin=stream,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);assert r.returncode==0
   (STAGE/'backup-check.json').write_text(json.dumps(dict(sha256=sha(STAGE/'database-before.dump'),tocLines=len(r.stdout.splitlines()),schema=32,databaseRestoreForbidden=True)))
   shutil.copyfile(STAGE/'compose.after.yml',ROOT/'compose.production.yml');run(*m.compose(),'config','--quiet')
   run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','core-service');m.wait_health('core-service')
   assert m.sql('select md5(json_agg(t order by installed_rank)::text) from flyway_schema_history t')==history,'Unexpected migration change'
   summary=json.loads(run('docker','exec','bobuy-core-service','curl','-fsS','http://127.0.0.1:8081/api/storefront/product-reviews/018775a1-c531-4d89-bb61-5148b6a1df05'))['data'];assert len(summary['distribution'])==9
   assert run('docker','exec','bobuy-core-service','sha256sum','/app/app.jar').split()[0]==a['coreJarSha256']
   assert run('docker','exec','bobuy-core-service','curl','-fsS','-o','/dev/null','-w','%{http_code}','http://127.0.0.1:8081/api/storefront/recommendation-images/e5d42bc7-e135-46dd-ae28-2e689ad56ed6')=='200'
   run('docker','start',*['bobuy-'+n for n in m.WRITERS if n!='core-service'])
   for n in m.WRITERS:m.wait_health(n)
   assert m.state('core-service')['image']==image['imageId'] and m.state('frontend')==before['frontend']
   for n in m.PROTECTED:assert m.state(n)==before[n]
   assert json.loads(run('python3',str(ROOT/'scripts/protected-node-state.py')))==read(STAGE/'protected-before.json')
   actual=m.frozen_content(baseline);assert actual==baseline,'Business data changed under freeze'
   (STAGE/'content.after.json').write_text(json.dumps(actual,indent=2));assert time.monotonic()-start<300
   opened=True;mark('OPENING_WRITES',source=a['source']);nginx.write_text(original);run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload')
   mark('WRITES_OPEN',source=a['source'],seconds=round(time.monotonic()-start,2),databaseVersion=32,sqlMigration=False,imagesUpdated=['core-service'],contentUnchanged=True)
  except Exception as error:
   if opened:
    mark('FORWARD_RECOVERY_REQUIRED',reason=str(error),databaseRestoreForbidden=True);raise
   # Application-only rollback keeps all V32 records, including reviews.
   shutil.copyfile(STAGE/'compose.before.yml',ROOT/'compose.production.yml');run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','core-service');run('docker','start',*['bobuy-'+n for n in m.WRITERS if n!='core-service'])
   for n in m.WRITERS:m.wait_health(n)
   nginx.write_text(original);run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload');mark('APPLICATION_ROLLED_BACK',reason=str(error),databaseUnchanged=True);raise
if __name__=='__main__':main()
