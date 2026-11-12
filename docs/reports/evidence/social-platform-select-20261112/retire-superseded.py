"""Retire only this task's superseded frontend base and never-activated image."""
from pathlib import Path
import fcntl,hashlib,importlib.util,json,subprocess,time
root=Path('/opt/bobuy');stage=root/'releases/20261112.social-platform-select.2'
def run(*a):return subprocess.check_output(a,text=True).strip()
def read(p):return json.loads(p.read_text())
with (root/'releases/engagement-global.lock').open('a+') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 a=read(stage/'artifact.json');assert a['source']=='ec24fa9af47b38999b98fc848e8ccf77787ddad2'
 assert time.time()-read(stage/'activated.json')['at']>=120
 lib=root/'releases/20261111.1/release_operator.py'
 assert hashlib.sha256(lib.read_bytes()).hexdigest()=='5fddec223ef6f1d38402c8a11c1f99877ffc93f9d7d4b5afeb1271752c5610ac'
 spec=importlib.util.spec_from_file_location('release',lib);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 before=read(stage/'runtime.before.json')
 def verify():
  assert m.state('frontend')['image']==a['images'][0]['imageId']
  assert m.state('frontend')['revision']==a['source']
  for name,value in before.items():
   if name!='frontend':assert m.state(name)==value
  assert json.loads(run('python3',str(root/'scripts/protected-node-state.py')))==read(stage/'protected.before.json')
  assert run('curl','--fail','--silent','--output','/dev/null','--write-out','%{http_code}','https://bobuy.cc/api/health')=='200'
 def unused(digest):
  ids=run('docker','ps','-aq').splitlines()
  if ids:assert all(c['Image']!=digest for c in json.loads(run('docker','inspect',*ids)))
 verify();removed=[]
 initial=read(root/'releases/20261112.social-platform-select/artifact.json')
 old=initial['baseFrontend']
 assert old['tag']=='bobuy/frontend:20261112.mail-settings.3' and old['revision']=='f4fae3d05d61c2b697cba4f6ac62f07b55d58790'
 found=run('docker','image','ls','--no-trunc','--filter','reference='+old['tag'],'--format','{{.ID}}')
 if found:
  assert found==old['image'];unused(found);run('docker','image','rm','--no-prune',old['tag']);removed.append(old['tag'])
 for digest in set(run('docker','image','ls','--no-trunc','--filter','label=org.opencontainers.image.revision=383247c457ab16d034289cf1f281bb905b963724','--format','{{.ID}}').splitlines()):
  image=json.loads(run('docker','image','inspect',digest))[0]
  assert not image.get('RepoTags') and digest!=a['images'][0]['imageId'];unused(digest)
  run('docker','image','rm','--no-prune',digest);removed.append(digest)
 verify();print(json.dumps({'source':a['source'],'result':'PASS','removedOnly':removed,'protectedUnchanged':True,'databaseWrites':False}))
