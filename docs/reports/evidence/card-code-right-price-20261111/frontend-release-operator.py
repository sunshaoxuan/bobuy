"""Frontend-only activation with immutable bindings and application rollback."""
from pathlib import Path
import argparse,fcntl,hashlib,importlib.util,json,os,shutil,subprocess,time
ROOT=Path('/opt/bobuy');STAGE=ROOT/'releases/20261112.1'
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read(path):return json.loads(Path(path).read_text())
def main():
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','activate']);parser.add_argument('--apply-production-window',action='store_true');args=parser.parse_args()
 assert args.apply_production_window and os.geteuid()==0 and not ROOT.is_symlink() and not STAGE.is_symlink()
 os.umask(0o077);a=read(STAGE/'artifact.json');assert a['release']=='20261112.1' and a['image']['name']=='frontend'
 assert sha(STAGE/'frontend-release-operator.py')==a['operatorSha256']
 library=ROOT/'releases/20261111.1/release_operator.py';assert sha(library)==a['librarySha256']
 spec=importlib.util.spec_from_file_location('accepted_library',library);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 g=read(STAGE/'gates.json');assert sha(STAGE/'gates.json')==a['gatesSha256'] and g['source']==a['source'] and g['result']=='PASS'
 image=json.loads(m.run('docker','image','inspect',a['image']['tag']))[0];assert image['Id']==a['image']['imageId'] and image['Config']['Labels']['org.opencontainers.image.revision']==a['source']
 def mark(phase,**extra):
  (STAGE/'status.tmp').write_text(json.dumps(dict(phase=phase,source=a['source'],at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**extra),indent=2));(STAGE/'status.tmp').replace(STAGE/'status.json')
 def files():
  return {name.removeprefix('./'):digest for digest,name in (line.split(None,1) for line in m.run('docker','exec','bobuy-frontend','sh','-c','cd /usr/share/nginx/html && find . -type f -exec sha256sum {} \\;').splitlines())}
 with (STAGE/'operator.lock').open('a+') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  names=(*m.WRITERS,'frontend',*m.PROTECTED)
  if args.action=='prepare':
   assert not (STAGE/'status.json').exists()
   before={n:m.state(n) for n in names};assert all(v['health'] in ('healthy','running') for v in before.values())
   assert before['frontend']['revision']=='245eb3ae1b5738d63d6013de90e7a84fb5e46862' and before['frontend']['tag']=='bobuy/frontend:20261111.5'
   original=(ROOT/'compose.production.yml').read_text();after=m.rewrite_images(original,[a['image']],before)
   (STAGE/'compose.before.yml').write_text(original);(STAGE/'compose.after.yml').write_text(after);(STAGE/'runtime.before.json').write_text(json.dumps(before,indent=2));(STAGE/'protected-before.json').write_text(m.run('python3',str(ROOT/'scripts/protected-node-state.py')))
   m.media_flags();mark('PREPARED',imagesChanged=['frontend'],databaseChanged=False);return
  assert read(STAGE/'status.json')['phase']=='PREPARED';before=read(STAGE/'runtime.before.json')
  for n in names:assert m.state(n)==before[n],'Concurrent runtime change'
  assert (ROOT/'compose.production.yml').read_text()==(STAGE/'compose.before.yml').read_text()
  try:
   mark('ACTIVATING_FRONTEND');shutil.copyfile(STAGE/'compose.after.yml',ROOT/'compose.production.yml');m.run(*m.compose(),'config','--quiet');m.run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','frontend');m.wait_health('frontend')
   m.run('docker','exec','bobuy-frontend','nginx','-t');actual=files();assert all(actual.get(name)==digest for name,digest in a['frontend'].items())
   current=m.state('frontend');assert current['image']==a['image']['imageId'] and current['revision']==a['source']
   for n in names:
    if n!='frontend':assert m.state(n)==before[n],'Unscoped service changed'
   assert json.loads(m.run('python3',str(ROOT/'scripts/protected-node-state.py')))==read(STAGE/'protected-before.json')
   m.media_flags();mark('FRONTEND_HEALTHY',imagesChanged=['frontend'],databaseChanged=False,otherServicesUnchanged=True,exactFrontendFiles=len(a['frontend']))
  except Exception as error:
   shutil.copyfile(STAGE/'compose.before.yml',ROOT/'compose.production.yml');m.run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','frontend');m.wait_health('frontend');assert m.state('frontend')['image']==before['frontend']['image'];mark('FRONTEND_ROLLED_BACK',reason=str(error),databaseChanged=False);raise
if __name__=='__main__':main()
