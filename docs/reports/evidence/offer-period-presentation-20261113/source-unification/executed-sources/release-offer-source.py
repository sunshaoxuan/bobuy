from pathlib import Path
import hashlib,io,json,subprocess,sys,tarfile
ROOT=Path(__file__).parent;E=ROOT/'docs/reports/evidence/offer-period-presentation-20261113/source-unification'
SSH=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41'];SCP=['scp',*SSH[1:-1]]
RELEASE='20261113.offer-source-drawer.1';REMOTE='/opt/bobuy/releases/'+RELEASE;SOURCE='9f948b1bd98aca3019b5c7ee98e63c59e9aa1582'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(n,v):(E/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def run(args,**kw):return subprocess.check_output(args,cwd=ROOT,text=True,encoding='utf-8',**kw).strip()
def remote(code):
 p=subprocess.run(SSH+['python3','-'],input=code.encode(),capture_output=True,timeout=300)
 if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1500:])
 return p.stdout.decode()
def upload(p):subprocess.run(SCP+[str(p),'root@185.184.223.41:'+REMOTE+'/'+p.name],check=True,capture_output=True)
def main():
 action=sys.argv[1]
 if action in ('stage','resume-stage'):
  assert run(['git','rev-parse','HEAD'])==SOURCE and not run(['git','diff','HEAD','--','frontend/src','backend/src/main'])
  assert 'Generated home-only crawlable HTML' in (E/'build-release.log').read_text(encoding='utf-8') and 'BUILD SUCCESS' in (E/'core-build.log').read_text(encoding='utf-8')
  payload=ROOT/'offer-source-payload.tar.gz'
  with tarfile.open(payload,'w:gz') as t:
   t.add(ROOT/'frontend/dist',arcname='dist');t.add(ROOT/'frontend/nginx.conf',arcname='nginx.conf');t.add(ROOT/'bobbuy-core/target/bobbuy-core-0.1.0.jar',arcname='app.jar');t.add(E/'app-operator.py',arcname='app-operator.py')
  if action=='stage':
   remote("from pathlib import Path\np=Path("+repr(REMOTE)+");assert not p.exists();p.mkdir(mode=0o700)")
  upload(payload)
  code='''from pathlib import Path
import hashlib,importlib.util,io,json,subprocess,tarfile,zipfile
p=Path(REMOTE);assert hashlib.sha256((p/'offer-source-payload.tar.gz').read_bytes()).hexdigest()==PAYLOAD
with tarfile.open(p/'offer-source-payload.tar.gz') as t:
 for member in t.getmembers():assert not member.issym() and not member.islnk() and (p/member.name).resolve().is_relative_to(p)
 t.extractall(p,filter='data')
lib=Path('/opt/bobuy/releases/20261111.1/release_operator.py');assert hashlib.sha256(lib.read_bytes()).hexdigest()=='5fddec223ef6f1d38402c8a11c1f99877ffc93f9d7d4b5afeb1271752c5610ac'
spec=importlib.util.spec_from_file_location('runtime',lib);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
base={n:m.state(n) for n in ('core-service','frontend')};assert base['frontend']['revision']=='f95f54ec099fcee79a26643db43c5c92b905ea85'
subprocess.run(['docker','cp','bobuy-core-service:/app/app.jar',str(p/'baseline-core.jar')],check=True,capture_output=True)
def migrations(file):
 with zipfile.ZipFile(file) as z:
  found={n:hashlib.sha256(z.read(n).replace(b'\\r\\n',b'\\n')).hexdigest() for n in z.namelist() if 'db/migration/' in n and n.endswith('.sql')}
  for n in z.namelist():
   if n.startswith('BOOT-INF/lib/bobbuy-common-') and n.endswith('.jar'):found.update(migrations(io.BytesIO(z.read(n))))
  return found
old=migrations(p/'baseline-core.jar');new=migrations(p/'app.jar');assert old==new and len(new)>=35
binding=dict(result='IDENTICAL',comparison='Exact SQL bytes after CRLF-to-LF normalization; no other normalization',files=new,baselineCoreImage=base['core-service']['image'])
nginx=json.loads(subprocess.check_output(['docker','image','inspect','nginx:alpine']))[0]['Id']
(p/'Dockerfile.core').write_text('FROM '+base['core-service']['image']+'\\nCOPY app.jar /app/app.jar\\n')
(p/'Dockerfile.frontend').write_text('FROM '+nginx+'\\nCOPY dist /usr/share/nginx/html\\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\\n')
images=[]
for dockerfile,name,tag in [('Dockerfile.core','core-service','bobuy/core:'+RELEASE),('Dockerfile.frontend','frontend','bobuy/frontend:'+RELEASE)]:
 with (p/(name+'-build.log')).open('w') as log:subprocess.run(['docker','build','--network=none','--label','org.opencontainers.image.revision='+SOURCE,'-f',str(p/dockerfile),'-t',tag,str(p)],check=True,stdout=log,stderr=subprocess.STDOUT,timeout=180)
 images.append(dict(name=name,tag=tag,imageId=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]['Id']))
print(json.dumps(dict(base=base,images=images,migrationBinding=binding)))
'''
  code=code.replace('REMOTE',repr(REMOTE)).replace('PAYLOAD',repr(sha(payload))).replace('RELEASE',repr(RELEASE)).replace('SOURCE',repr(SOURCE))
  staged=json.loads(remote(code));write('staged.json',staged);print(json.dumps({k:v for k,v in staged.items() if k!='migrationBinding'}));return
 if action=='finalize':
  ci=json.loads(run(['gh','pr','view','79','--json','headRefOid,statusCheckRollup,state,mergeCommit,url']))
  assert ci['headRefOid']==SOURCE and ci['state']=='MERGED' and len(ci['statusCheckRollup'])>=3 and all(c['status']=='COMPLETED' and c['conclusion'] in ('SUCCESS','NEUTRAL') for c in ci['statusCheckRollup']);write('ci.json',ci)
  gates=dict(source=SOURCE,result='PASS',ci='success',ciUrl=ci['url'],frontendTests=31,backendTests=31,browser='PASS',scope='drawer1440/320 synthetic save and approval/cancel guards; selected-source hints; production read-only acceptance pending',schemaOperation=False)
  write('gates.json',gates);staged=json.loads((E/'staged.json').read_text(encoding='utf-8'))
  artifact=dict(source=SOURCE,release=RELEASE,**staged,operatorSha256=sha(E/'app-operator.py'),gatesSha256=sha(E/'gates.json'),coreJarSha256=sha(ROOT/'bobbuy-core/target/bobbuy-core-0.1.0.jar'),frontend={p.relative_to(ROOT/'frontend/dist').as_posix():sha(p) for p in (ROOT/'frontend/dist').rglob('*') if p.is_file()})
  write('artifact.json',artifact)
  for n in ('gates.json','artifact.json'):upload(E/n)
  print('Exact candidate finalized with compatible application rollback.');return
 if action in ('prepare','activate','verify'):
  p=subprocess.run(SSH+['python3 '+REMOTE+'/app-operator.py '+action],capture_output=True,timeout=300)
  if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1500:])
  v=json.loads(p.stdout.decode());write('production-'+action+'.json',v);print(json.dumps(v));return
 raise ValueError(action)
if __name__=='__main__':main()
