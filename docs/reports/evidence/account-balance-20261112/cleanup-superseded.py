"""Delete only this task's obsolete tags, preserving the later release's rollback image."""
from pathlib import Path
import fcntl,json,subprocess,time,sys
ROOT=Path('/opt/bobuy/releases')
OWN=ROOT/'20261112.account-balance'
SOURCE='deac521fdb5c10e4accc2d4cc368fb494ab61801'
IMAGE='sha256:5ae6a26f18e1b5a5986284873f16634363e21cfe0bc604f294b512840c9fa06b'
ROLLBACK=('bobuy/frontend:20261112.5','sha256:b938535cdca8147aee6ded4d631d1c2fe505cfcdefd87d3c31f87c95e0f1adf9')
OLD=[('bobuy/frontend:20261112.account-balance','sha256:dbdac9bd7db5cf373c39feafd60e48533c3e3c805974469f08b0f56425fd5c7a'),('bobuy/frontend:20261112.detail-layout.2','sha256:cf82a90acf09497c65a1c3cf2fc399d0ac5b7973c08cb19df62b39be26a08ffe')]
def run(args):return subprocess.check_output(args,text=True).strip()
def read(path):return json.loads(path.read_text())
def state():
 c=json.loads(run(['docker','inspect','bobuy-frontend']))[0]
 assert c['Image']==IMAGE and c['Config']['Labels']['org.opencontainers.image.revision']==SOURCE
 assert c['State']['Running'] and c['RestartCount']==0
 core=json.loads(run(['docker','inspect','bobuy-core-service']))[0]
 assert core['State']['Health']['Status']=='healthy'
 assert core['Config']['Labels']['org.opencontainers.image.revision']==SOURCE
 assert run(['curl','--max-time','15','-sS','-o','/dev/null','-w','%{http_code}','https://bobuy.cc/api/health'])=='200'
 rollback=json.loads(run(['docker','image','inspect',ROLLBACK[0]]))[0]
 assert rollback['Id']==ROLLBACK[1] and rollback['Config']['Labels']['org.opencontainers.image.revision']=='606deb375b125d41e451dad555bb306f70f0fae3'
 return c
assert len(sys.argv)==2 and sys.argv[1] in ['plan','apply']
with (ROOT/'engagement-global.lock').open('a+') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 state();seconds=time.time()-read(OWN/'activated.json')['at']
 if sys.argv[1]=='plan':
  print(json.dumps({'source':SOURCE,'accountLayoutSeconds':round(seconds,1),'minimumSeconds':600,'eligible':seconds>=600,'rollbackPreserved':ROLLBACK[0],'scope':[t for t,_ in OLD]}));sys.exit(0)
 assert seconds>=600
 protected=run(['python3','/opt/bobuy/scripts/protected-node-state.py'])
 removed=[];absent=[]
 for tag,digest in OLD:
  assert tag!=ROLLBACK[0] and digest not in (IMAGE,ROLLBACK[1])
  existing=run(['docker','image','ls','--no-trunc','--filter','reference='+tag,'--format','{{.ID}}'])
  if not existing:absent.append(tag);continue
  assert existing==digest
  # Ancestor filters also match child image layers. Guard exact container images;
  # --no-prune keeps layers required by the current descendant image.
  ids=run(['docker','ps','-aq']).split()
  assert all(c['Image']!=digest for c in json.loads(run(['docker','inspect',*ids])))
  run(['docker','image','rm','--no-prune',tag]);removed.append(tag)
 state();assert run(['python3','/opt/bobuy/scripts/protected-node-state.py'])==protected
 result={'source':SOURCE,'phase':'CLEANED','at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'accountLayoutSeconds':round(seconds,1),'removedOnly':removed,'alreadyAbsent':absent,'currentImage':IMAGE,'rollbackPreserved':ROLLBACK[0],'databaseWrites':False,'protectedUnchanged':True}
 (OWN/'superseded-cleanup.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
