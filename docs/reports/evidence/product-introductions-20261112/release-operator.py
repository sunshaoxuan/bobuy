"""Scoped application-only release. Database restore is never performed."""
from pathlib import Path
import argparse,fcntl,hashlib,importlib.util,json,os,shutil,subprocess,time
ROOT=Path('/opt/bobuy');STAGE=ROOT/'releases/20261112.product-introductions.2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def run(*args):
 p=subprocess.run(args,capture_output=True,text=True,timeout=180)
 if p.returncode:raise RuntimeError('Scoped command failed: '+args[0]+'; output suppressed')
 return p.stdout.strip()
def main():
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','activate']);parser.add_argument('--apply-production-window',action='store_true');args=parser.parse_args()
 assert args.apply_production_window and os.geteuid()==0 and not ROOT.is_symlink() and not STAGE.is_symlink()
 os.umask(0o077);a=read(STAGE/'artifact.json');assert sha(STAGE/'release-operator.py')==a['operatorSha256']
 library=ROOT/'releases/20261111.1/release_operator.py';assert sha(library)==a['librarySha256']
 spec=importlib.util.spec_from_file_location('accepted_library',library);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.STAGE=STAGE
 h=m.helpers(a)
 def mark(phase,**extra):
  value=dict(phase=phase,source=a['source'],at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**extra)
  (STAGE/'status.tmp').write_text(json.dumps(value,indent=2));(STAGE/'status.tmp').replace(STAGE/'status.json')
 with (ROOT/'releases/engagement-global.lock').open('a+') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  assert [i['name'] for i in a['images']]==['core-service','frontend']
  g=read(STAGE/'gates.json');assert sha(STAGE/'gates.json')==a['gatesSha256'] and g['source']==a['source'] and g['result']=='PASS' and g['backend']['failures']==0 and g['backend']['errors']==0 and g['configuredJacoco']=='PASS' and g['browser']=='PASS' and g['codeql']=='success'
  assert sha(STAGE/'migration-binding.json')==a['migrationBindingSha256'] and read(STAGE/'migration-binding.json')['result']=='PASS'
  for i in a['images']:
   d=json.loads(run('docker','image','inspect',i['tag']))[0];assert d['Id']==i['imageId'] and d['Config']['Labels']['org.opencontainers.image.revision']==a['source']
  if args.action=='prepare':
   assert not (STAGE/'status.json').exists()
   before={n:m.state(n) for n in (*m.WRITERS,'frontend',*m.PROTECTED)}
   assert all(before[n][k]==a['base'][n][k] for n in ('core-service','frontend') for k in ('revision','tag','image'))
   assert all(v['health'] in ('healthy','running') for v in before.values())
   assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='33'
   m.media_flags();original=(ROOT/'compose.production.yml').read_text();after=m.rewrite_images(original,a['images'],before)
   (STAGE/'compose.before.yml').write_text(original);(STAGE/'compose.after.yml').write_text(after);(STAGE/'runtime.before.json').write_text(json.dumps(before,indent=2));(STAGE/'protected-before.json').write_text(run('python3',str(ROOT/'scripts/protected-node-state.py')))
   mark('PREPARED',sqlMigration=False);return
  assert read(STAGE/'status.json')['phase']=='PREPARED';before=read(STAGE/'runtime.before.json')
  for n,value in before.items():assert m.state(n)==value,'Concurrent runtime change'
  assert (ROOT/'compose.production.yml').read_text()==(STAGE/'compose.before.yml').read_text()
  nginx=ROOT/'infra/nginx/bobuy.conf';original=nginx.read_text();(STAGE/'nginx.before.conf').write_text(original);opened=False;start=time.monotonic()
  try:
   mark('FREEZING');nginx.write_text(h.maintenance_config(original));run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload');run('docker','stop',*['bobuy-'+n for n in m.WRITERS])
   baseline=m.frozen_content();(STAGE/'content.before.json').write_text(json.dumps(baseline,indent=2));history=m.sql('select md5(json_agg(t order by installed_rank)::text) from flyway_schema_history t')
   with (STAGE/'database-before.dump').open('wb') as stream:
    p=subprocess.run(['docker','exec','bobuy-postgres','sh','-c','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],stdout=stream,stderr=subprocess.PIPE,timeout=120);assert p.returncode==0
   with (STAGE/'database-before.dump').open('rb') as stream:
    p=subprocess.run(['docker','exec','-i','bobuy-postgres','pg_restore','--list'],stdin=stream,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);assert p.returncode==0
   (STAGE/'backup-check.json').write_text(json.dumps(dict(sha256=sha(STAGE/'database-before.dump'),tocLines=len(p.stdout.splitlines()),databaseRestoreForbidden=True)))
   shutil.copyfile(STAGE/'compose.after.yml',ROOT/'compose.production.yml');run(*m.compose(),'config','--quiet');run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','core-service','frontend');m.wait_health('core-service');m.wait_health('frontend')
   assert m.sql('select md5(json_agg(t order by installed_rank)::text) from flyway_schema_history t')==history
   assert run('docker','exec','bobuy-core-service','sha256sum','/app/app.jar').split()[0]==a['coreJarSha256']
   actual={name.removeprefix('./'):digest for digest,name in (line.split(None,1) for line in run('docker','exec','bobuy-frontend','sh','-c','cd /usr/share/nginx/html && find . -type f -exec sha256sum {} \\;').splitlines())};assert all(actual.get(name)==digest for name,digest in a['frontend'].items())
   run('docker','start',*['bobuy-'+n for n in m.WRITERS if n!='core-service'])
   for n in m.WRITERS:m.wait_health(n)
   for i in a['images']:assert m.state(i['name'])['image']==i['imageId']
   for n in m.PROTECTED:assert m.state(n)==before[n]
   assert json.loads(run('python3',str(ROOT/'scripts/protected-node-state.py')))==read(STAGE/'protected-before.json')
   assert m.frozen_content(baseline)==baseline;assert time.monotonic()-start<300
   card=json.loads(run('docker','exec','bobuy-core-service','curl','-fsS','http://127.0.0.1:8081/api/storefront/product-browse?query=77839&locale=zh-CN'))['data']['items'];assert len(card)==1 and card[0]['itemNumber']=='77839'
   detail=json.loads(run('docker','exec','bobuy-core-service','curl','-fsS','http://127.0.0.1:8081/api/storefront/product-browse/0451e987-1bc1-498d-8494-a7b9be9adbb7'))['data']['item']
   assert all(detail['introduction'].get(l) for l in ('ja-JP','zh-CN','zh-TW','en-US'))
   assert card[0]['reference']['amount']==1498 and card[0]['reference']['originalPrice'] is None and card[0]['reference']['discountAmount'] is None and card[0]['reference']['postId']==5
   (STAGE/'price-acceptance.json').write_text(json.dumps(dict(result='PASS',itemNumber='77839',amount=1498,channel='COSTCO_WAREHOUSE',discountHidden=True,sourcePost=5)))
   opened=True;mark('OPENING_WRITES');nginx.write_text(original);run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload');mark('WRITES_OPEN',seconds=round(time.monotonic()-start,2),sqlMigration=False,contentUnchanged=True)
  except Exception as error:
   if opened:mark('FORWARD_RECOVERY_REQUIRED',reason=str(error),databaseRestoreForbidden=True);raise
   shutil.copyfile(STAGE/'compose.before.yml',ROOT/'compose.production.yml');run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','core-service','frontend');run('docker','start',*['bobuy-'+n for n in m.WRITERS if n!='core-service'])
   for n in m.WRITERS:m.wait_health(n)
   nginx.write_text(original);run('docker','exec','bobuy-gateway','nginx','-t');run('docker','exec','bobuy-gateway','nginx','-s','reload');mark('APPLICATION_ROLLED_BACK',reason=str(error),databaseUnchanged=True);raise
if __name__=='__main__':main()
