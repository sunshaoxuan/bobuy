from pathlib import Path
import hashlib,json,subprocess,tarfile,sys
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'docs/reports/evidence/daily-product-offer-tags-20261112/detail-period-20261113';E.mkdir(exist_ok=True,parents=True)
SSH=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41']
SCP=['scp','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem']
RELEASE='20261113.detail-offer-period.1';REMOTE='/opt/bobuy/releases/'+RELEASE
def run(args,**kw):return subprocess.check_output(args,cwd=ROOT,text=True,encoding='utf-8',**kw).strip()
def remote(code):
 p=subprocess.run(SSH+['python3','-'],input=code.encode(),capture_output=True,timeout=180)
 if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1500:])
 return p.stdout.decode()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(n,v):(E/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def main():
 if sys.argv[1]=='stage':
  source=run(['git','rev-parse','HEAD']);assert source.startswith('817675d')
  assert not run(['git','diff','HEAD','--','frontend'])
  ci=json.loads(run(['gh','run','view','43255502046','--json','headSha,status,conclusion,url']))
  assert ci['headSha']==source and ci['status']=='completed' and ci['conclusion']=='success'
  write('ci.json',ci)
  assert 'Generated home-only crawlable HTML' in (ROOT/'.task-tmp/offer-period-build.log').read_text(encoding='utf-8')
  accepted=json.loads((E/'local/acceptance.json').read_text(encoding='utf-8'));assert accepted['result']=='PASS'
  operator=(ROOT/'docs/reports/evidence/home-brand-text-20261113/frontend-operator.py').read_text(encoding='utf-8').replace('20261113.brand-name.1',RELEASE)
  (E/'frontend-operator.py').write_text(operator,encoding='utf-8')
  payload=ROOT/'.task-tmp/offer-period-payload.tar.gz'
  with tarfile.open(payload,'w:gz') as t:
   t.add(ROOT/'frontend/dist',arcname='dist');t.add(ROOT/'frontend/nginx.conf',arcname='nginx.conf');t.add(E/'frontend-operator.py',arcname='frontend-operator.py')
  remote("from pathlib import Path\np=Path("+repr(REMOTE)+");assert not p.exists();p.mkdir(mode=0o700)")
  subprocess.run(SCP+[str(payload),'root@185.184.223.41:'+REMOTE+'/payload.tar.gz'],check=True,capture_output=True)
  code='''import json,subprocess,hashlib,tarfile
from pathlib import Path
p=Path(REMOTE);assert hashlib.sha256((p/'payload.tar.gz').read_bytes()).hexdigest()==PAYLOAD
with tarfile.open(p/'payload.tar.gz') as t:
 for v in t.getmembers():assert not v.issym() and not v.islnk() and (p/v.name).resolve().is_relative_to(p)
 t.extractall(p,filter='data')
def state(n):
 d=json.loads(subprocess.check_output(['docker','inspect',n]))[0];return dict(image=d['Image'],tag=d['Config']['Image'],revision=d['Config']['Labels'].get('org.opencontainers.image.revision'))
before=dict(baseFrontend=state('bobuy-frontend'),baseCore=state('bobuy-core-service'))
assert before['baseFrontend']['revision']=='8af5c8e3e2fcc6581fe80f29dc91190212a47b34'
base=json.loads(subprocess.check_output(['docker','image','inspect','nginx:alpine']))[0]['Id']
(p/'Dockerfile').write_text('FROM '+base+'\\nCOPY dist /usr/share/nginx/html\\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\\n')
with (p/'image-build.log').open('w') as log:subprocess.run(['docker','build','--network=none','--label','org.opencontainers.image.revision='+SOURCE,'-t','bobuy/frontend:'+RELEASE,str(p)],check=True,stdout=log,stderr=subprocess.STDOUT,timeout=120)
before['imageId']=json.loads(subprocess.check_output(['docker','image','inspect','bobuy/frontend:'+RELEASE]))[0]['Id'];print(json.dumps(before))
'''
  code=code.replace('REMOTE',repr(REMOTE)).replace('PAYLOAD',repr(sha(payload))).replace('SOURCE',repr(source)).replace('RELEASE',repr(RELEASE))
  staged=json.loads(remote(code));write('staged.json',staged)
  gates=dict(source=source,result='PASS',ci='success',ciUrl=ci['url'],acceptanceSha256=sha(E/'local/acceptance.json'),buildLogSha256=sha(ROOT/'.task-tmp/offer-period-build.log'),frontendOnly=True,databaseOperation=False);write('gates.json',gates)
  artifact=dict(source=source,release=RELEASE,baseFrontend=staged['baseFrontend'],baseCore=staged['baseCore'],operatorSha256=sha(E/'frontend-operator.py'),gatesSha256=sha(E/'gates.json'),frontend={p.relative_to(ROOT/'frontend/dist').as_posix():sha(p) for p in (ROOT/'frontend/dist').rglob('*') if p.is_file()},images=[dict(name='frontend',tag='bobuy/frontend:'+RELEASE,imageId=staged['imageId'])]);write('artifact.json',artifact)
  for n in ['gates.json','artifact.json']:subprocess.run(SCP+[str(E/n),'root@185.184.223.41:'+REMOTE+'/'+n],check=True,capture_output=True)
  print('Staged frontend candidate with exact assets and recovery bindings.')
 elif sys.argv[1] in ['prepare','activate','verify']:
  action=sys.argv[1];p=subprocess.run(SSH+['flock -n /opt/bobuy/releases/engagement-global.lock python3 '+REMOTE+'/frontend-operator.py '+action],capture_output=True,timeout=180)
  if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1500:])
  value=json.loads(p.stdout.decode());write('production-'+action+'.json',value);print(json.dumps(value))
 else:raise ValueError(sys.argv[1])
if __name__=='__main__':main()
