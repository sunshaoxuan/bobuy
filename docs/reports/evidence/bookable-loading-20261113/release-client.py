from pathlib import Path
import hashlib,json,subprocess,sys,tarfile
sys.dont_write_bytecode=True
E=Path(__file__).parent;ROOT=E.parents[3];RELEASE='20261113.public-trip-recovery.1';REMOTE='/opt/bobuy/releases/'+RELEASE
SSH=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41'];SCP=['scp',*SSH[1:-1]]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(n,v):(E/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def run(args):return subprocess.check_output(args,cwd=ROOT,text=True,encoding='utf-8').strip()
def remote(code):
 p=subprocess.run(SSH+['python3','-'],input=code.encode(),capture_output=True,timeout=180)
 if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1500:])
 return p.stdout.decode()
def upload(p):subprocess.run(SCP+[str(p),'root@185.184.223.41:'+REMOTE+'/'+p.name],check=True,capture_output=True)
def main():
 action=sys.argv[1]
 if action=='stage':
  source=run(['git','rev-parse','HEAD']);assert not run(['git','diff','HEAD','--','frontend/src'])
  assert 'Generated home-only crawlable HTML' in (E/'build-phase2.log').read_text(encoding='utf-8')
  browser=json.loads((E/'browser-phase2.json').read_text(encoding='utf-8'));assert browser['transient']['afterFirstFailure']==dict(spinners=1,empty=False,error=False) and browser['transient']['afterSecondFailure']==dict(spinners=1,empty=False,error=False) and browser['exhaustion']['state']==dict(empty=True,error=False,spinners=0) and len([v for v in browser['exhaustion']['requests'] if v['attempt']!='active'])==3 and all(not v['authorization'] for v in browser['transient']['requests']) and not browser['console'];assert 'Tests  67 passed (67)' in (E/'tests-phase2.log').read_text(encoding='utf-8')
  operator=(ROOT/'docs/reports/evidence/inclusive-offer-dates-20261113/frontend-operator.py').read_text(encoding='utf-8').replace('20261113.inclusive-offer-dates.1',RELEASE);(E/'frontend-operator.py').write_text(operator,encoding='utf-8')
  payload=E/'payload.tar.gz'
  with tarfile.open(payload,'w:gz') as t:t.add(ROOT/'frontend/dist',arcname='dist');t.add(ROOT/'frontend/nginx.conf',arcname='nginx.conf');t.add(E/'frontend-operator.py',arcname='frontend-operator.py')
  remote('from pathlib import Path\np=Path('+repr(REMOTE)+');assert not p.exists();p.mkdir(mode=0o700)');upload(payload)
  code='''from pathlib import Path
import hashlib,json,subprocess,tarfile
p=Path(REMOTE);assert hashlib.sha256((p/'payload.tar.gz').read_bytes()).hexdigest()==PAYLOAD
with tarfile.open(p/'payload.tar.gz') as t:
 for v in t.getmembers():assert not v.issym() and not v.islnk() and (p/v.name).resolve().is_relative_to(p)
 t.extractall(p,filter='data')
def state(n):
 d=json.loads(subprocess.check_output(['docker','inspect',n]))[0];return dict(image=d['Image'],tag=d['Config']['Image'],revision=d['Config']['Labels'].get('org.opencontainers.image.revision'))
before=dict(baseFrontend=state('bobuy-frontend'),baseCore=state('bobuy-core-service'))
assert before['baseFrontend']['revision']=='34b9952c65aa6d88ed14a4382b769fe3551fc722' and before['baseCore']['revision']=='9f948b1bd98aca3019b5c7ee98e63c59e9aa1582'
base=json.loads(subprocess.check_output(['docker','image','inspect','nginx:alpine']))[0]['Id']
(p/'Dockerfile').write_text('FROM '+base+'\\nCOPY dist /usr/share/nginx/html\\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\\n')
with (p/'image-build.log').open('w') as log:subprocess.run(['docker','build','--network=none','--label','org.opencontainers.image.revision='+SOURCE,'-t','bobuy/frontend:'+RELEASE,str(p)],check=True,stdout=log,stderr=subprocess.STDOUT,timeout=120)
before['imageId']=json.loads(subprocess.check_output(['docker','image','inspect','bobuy/frontend:'+RELEASE]))[0]['Id'];print(json.dumps(before))
'''
  staged=json.loads(remote(code.replace('REMOTE',repr(REMOTE)).replace('PAYLOAD',repr(sha(payload))).replace('SOURCE',repr(source)).replace('RELEASE',repr(RELEASE))))
  write('staged.json',dict(source=source,**staged));print('Frontend image staged; activation pending CI and merged PR.');return
 if action=='finalize':
  staged=json.loads((E/'staged.json').read_text(encoding='utf-8'));source=staged['source'];ci=json.loads((E/'ci-connector.json').read_text(encoding='utf-8'))
  assert ci['headRefOid']==source and ci['state']=='MERGED' and len(ci['statusCheckRollup'])>=3 and all(c['status']=='COMPLETED' and c['conclusion'] in ('SUCCESS','NEUTRAL') for c in ci['statusCheckRollup']);write('ci.json',ci)
  gates=dict(source=source,result='PASS',ci='success',frontendTests=67,browser='PASS',frontendOnly=True,databaseOperation=False);write('gates.json',gates)
  artifact=dict(source=source,release=RELEASE,baseFrontend=staged['baseFrontend'],baseCore=staged['baseCore'],operatorSha256=sha(E/'frontend-operator.py'),gatesSha256=sha(E/'gates.json'),frontend={p.relative_to(ROOT/'frontend/dist').as_posix():sha(p) for p in (ROOT/'frontend/dist').rglob('*') if p.is_file()},images=[dict(name='frontend',tag='bobuy/frontend:'+RELEASE,imageId=staged['imageId'])]);write('artifact.json',artifact)
  for n in ('gates.json','artifact.json'):upload(E/n)
  print('Frozen frontend candidate finalized.');return
 if action in ('prepare','activate','verify'):
  p=subprocess.run(SSH+['flock -n /opt/bobuy/releases/engagement-global.lock python3 '+REMOTE+'/frontend-operator.py '+action],capture_output=True,timeout=180)
  if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1500:])
  v=json.loads(p.stdout.decode());write('production-'+action+'.json',v);print(json.dumps(v));return
 raise ValueError(action)
if __name__=='__main__':main()
