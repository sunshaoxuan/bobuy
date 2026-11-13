"""Scoped frontend delivery; business data and other services remain untouched."""
from pathlib import Path
import hashlib,json,subprocess,sys,tarfile
ROOT=Path(__file__).resolve().parents[4];OUT=Path(__file__).resolve().parent
RELEASE='20261113.read-recovery.1';REMOTE='/opt/bobuy/releases/'+RELEASE
SSH=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41']
SCP=['scp','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem']
def run(args):return subprocess.check_output(args,cwd=ROOT,text=True,encoding='utf-8').strip()
def remote(code):
 p=subprocess.run(SSH+['python3','-'],input=code.encode(),capture_output=True,timeout=180)
 if p.returncode:raise RuntimeError('Remote operation failed: '+p.stderr.decode(errors='replace')[-800:])
 return p.stdout.decode()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(n,v):(OUT/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def main():
 action=sys.argv[1]
 if action=='preflight':
  result=json.loads(remote('''import hashlib,json,subprocess
from pathlib import Path
def state(n):
 d=json.loads(subprocess.check_output(['docker','inspect',n]))[0];return dict(image=d['Image'],tag=d['Config']['Image'],revision=d['Config']['Labels'].get('org.opencontainers.image.revision'),running=d['State']['Running'])
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
print(json.dumps(dict(frontend=state('bobuy-frontend'),core=state('bobuy-core-service'),routeSha=sha('/opt/bobuy/infra/nacos/config/gateway-service.yaml'),librarySha=sha('/opt/bobuy/releases/20261111.1/release_operator.py'))))
'''));write('production-before.json',result);print(json.dumps(result));return
 if action=='stage':
  source=run(['git','rev-parse','HEAD']);assert not run(['git','diff','HEAD','--','frontend'])
  before=json.loads((OUT/'production-before.json').read_text());accepted=json.loads((OUT/'local-browser.json').read_text());assert accepted['result']=='PASS'
  ci=json.loads((OUT/'ci.json').read_text());assert ci['headSha']==source and ci['status']=='completed' and ci['conclusion']=='success'
  operator=(ROOT/'docs/reports/evidence/home-brand-text-20261113/frontend-operator.py').read_text(encoding='utf-8').replace('20261113.brand-name.1',RELEASE)
  assert before['routeSha']=='b099bf59589e5b297699324d265209a112ad5b3865c51d1f174c12a427e6b391' and before['librarySha']=='5fddec223ef6f1d38402c8a11c1f99877ffc93f9d7d4b5afeb1271752c5610ac'
  (OUT/'frontend-operator.py').write_text(operator,encoding='utf-8')
  temp=ROOT/'.task-tmp/request-recovery';temp.mkdir(parents=True,exist_ok=True);payload=temp/'payload.tar.gz'
  with tarfile.open(payload,'w:gz') as t:
   t.add(ROOT/'frontend/dist',arcname='dist');t.add(ROOT/'frontend/nginx.conf',arcname='nginx.conf');t.add(OUT/'frontend-operator.py',arcname='frontend-operator.py')
  remote('from pathlib import Path\np=Path('+repr(REMOTE)+');assert not p.exists();p.mkdir(mode=0o700)')
  subprocess.run(SCP+[str(payload),'root@185.184.223.41:'+REMOTE+'/payload.tar.gz'],check=True,capture_output=True)
  code='''import json,subprocess,hashlib,tarfile
from pathlib import Path
p=Path(REMOTE);assert hashlib.sha256((p/'payload.tar.gz').read_bytes()).hexdigest()==PAYLOAD
with tarfile.open(p/'payload.tar.gz') as t:
 for v in t.getmembers():assert not v.issym() and not v.islnk() and (p/v.name).resolve().is_relative_to(p)
 t.extractall(p,filter='data')
def state(n):
 d=json.loads(subprocess.check_output(['docker','inspect',n]))[0];return dict(image=d['Image'],tag=d['Config']['Image'],revision=d['Config']['Labels'].get('org.opencontainers.image.revision'))
assert state('bobuy-frontend')==BASE_FRONT and state('bobuy-core-service')==BASE_CORE
base=json.loads(subprocess.check_output(['docker','image','inspect','nginx:alpine']))[0]['Id']
(p/'Dockerfile').write_text('FROM '+base+'\\nCOPY dist /usr/share/nginx/html\\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\\n')
with (p/'image-build.log').open('w') as log:subprocess.run(['docker','build','--network=none','--label','org.opencontainers.image.revision='+SOURCE,'-t','bobuy/frontend:'+RELEASE,str(p)],check=True,stdout=log,stderr=subprocess.STDOUT,timeout=120)
print(json.dumps(dict(imageId=json.loads(subprocess.check_output(['docker','image','inspect','bobuy/frontend:'+RELEASE]))[0]['Id'])))
'''
  bindings={'REMOTE':REMOTE,'PAYLOAD':sha(payload),'SOURCE':source,'RELEASE':RELEASE,'BASE_FRONT':{k:v for k,v in before['frontend'].items() if k!='running'},'BASE_CORE':{k:v for k,v in before['core'].items() if k!='running'}}
  for key in sorted(bindings,key=len,reverse=True):code=code.replace(key,repr(bindings[key]))
  staged=json.loads(remote(code));write('staged.json',staged)
  gates=dict(source=source,result='PASS',ci='success',ciUrl=ci['url'],acceptanceSha256=sha(OUT/'local-browser.json'),buildLogSha256=sha(OUT/'build.log'),frontendOnly=True,databaseOperation=False);write('gates.json',gates)
  artifact=dict(source=source,release=RELEASE,baseFrontend=bindings['BASE_FRONT'],baseCore=bindings['BASE_CORE'],operatorSha256=sha(OUT/'frontend-operator.py'),gatesSha256=sha(OUT/'gates.json'),frontend={p.relative_to(ROOT/'frontend/dist').as_posix():sha(p) for p in (ROOT/'frontend/dist').rglob('*') if p.is_file()},images=[dict(name='frontend',tag='bobuy/frontend:'+RELEASE,imageId=staged['imageId'])]);write('artifact.json',artifact)
  for name in ['gates.json','artifact.json']:subprocess.run(SCP+[str(OUT/name),'root@185.184.223.41:'+REMOTE+'/'+name],check=True,capture_output=True)
  print('Staged exact frontend candidate.');return
 if action in ['prepare','activate','verify']:
  p=subprocess.run(SSH+['flock -n /opt/bobuy/releases/engagement-global.lock python3 '+REMOTE+'/frontend-operator.py '+action],capture_output=True,timeout=180)
  if p.returncode:raise RuntimeError('Scoped operator failed: '+p.stderr.decode(errors='replace')[-800:])
  value=json.loads(p.stdout.decode());write('production-'+action+'.json',value);print(json.dumps(value));return
 raise ValueError(action)
if __name__=='__main__':main()
