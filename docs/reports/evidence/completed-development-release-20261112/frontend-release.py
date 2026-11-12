"""Version-pinned frontend-only gallery release. No production database writes."""
from pathlib import Path
import base64,hashlib,json,subprocess,sys,tarfile
ROOT=Path(__file__).resolve().parents[4];OUT=Path(__file__).resolve().parent
RELEASE='20261112.gallery-upload-feedback';REMOTE='/opt/bobuy/releases/'+RELEASE
SSH=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41']
SCP=['scp','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem']
BASE_FRONT='3a8b11ac97eab33f676b523af04af1f9922fd3f1';BASE_CORE='5a9bb64ab8cda965018bddacfe9471c1081ca34b'
def run(args,data=None):
 r=subprocess.run(args,input=data,capture_output=True)
 if r.returncode:raise RuntimeError('Scoped command failed: '+args[0]+' exit '+str(r.returncode))
 return r.stdout.decode('utf-8').strip()
def remote(code):return run(SSH+['python3 -c "import base64;exec(base64.b64decode(\''+base64.b64encode(code.encode()).decode()+'\'))"'])
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(n,v):(OUT/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def main():
 action=sys.argv[1];source=run(['git','rev-parse','HEAD'])
 if action=='stage':
  gates=json.loads((OUT/'frontend-gates.json').read_text());assert len(gates)==2 and all(g['exitCode']==0 for g in gates)
  assert not run(['git','diff','HEAD','--name-only','--','frontend'])
  assert not run(['git','diff',BASE_CORE,'--name-only','--','backend','bobbuy-core','bobbuy-common','pom.xml'])
  operator=(ROOT/'docs/reports/evidence/product-introductions-20261112/currency-final/frontend-operator.py').read_text().replace('20261112.product-introductions-currency',RELEASE).replace('product introduction currency layout','verified gallery upload feedback')
  (OUT/'frontend-operator.py').write_text(operator,encoding='utf-8')
  temp=ROOT/'.task-tmp/completed-release/payload';temp.mkdir(exist_ok=True)
  dockerfile=temp/'Dockerfile';dockerfile.write_text('FROM nginx@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d\nCOPY frontend /usr/share/nginx/html\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\n',encoding='utf-8')
  payload=temp/'payload.tar.gz'
  with tarfile.open(payload,'w:gz') as tar:
   tar.add(ROOT/'frontend/dist',arcname='frontend');tar.add(ROOT/'frontend/nginx.conf',arcname='nginx.conf');tar.add(dockerfile,arcname='Dockerfile')
  remote("from pathlib import Path\np=Path('"+REMOTE+"');assert not p.exists();p.mkdir(mode=0o700)")
  for p in [payload,OUT/'frontend-operator.py']:run(SCP+[str(p),'root@185.184.223.41:'+REMOTE+'/'+p.name])
  code="""from pathlib import Path
import hashlib,tarfile,subprocess,json
p=Path(REMOTE);assert hashlib.sha256((p/'payload.tar.gz').read_bytes()).hexdigest()==PAYLOAD_SHA
with tarfile.open(p/'payload.tar.gz') as tar:
 for v in tar.getmembers():assert not v.issym() and not v.islnk() and (p/v.name).resolve().is_relative_to(p)
 tar.extractall(p,filter='data')
def state(n):
 d=json.loads(subprocess.check_output(['docker','inspect',n]))[0];return dict(image=d['Image'],tag=d['Config']['Image'],revision=d['Config']['Labels'].get('org.opencontainers.image.revision'))
before=dict(baseFrontend=state('bobuy-frontend'),baseCore=state('bobuy-core-service'))
assert before['baseFrontend']['revision']==BASE_FRONT and before['baseCore']['revision']==BASE_CORE
for value in before.values():assert json.loads(subprocess.check_output(['docker','image','inspect',value['image']]))[0]['Id']==value['image']
with (p/'build.log').open('w') as log:subprocess.run(['docker','build','--network=none','--label','org.opencontainers.image.revision='+SOURCE,'-t','bobuy/frontend:'+RELEASE,str(p)],check=True,stdout=log,stderr=subprocess.STDOUT)
before['imageId']=json.loads(subprocess.check_output(['docker','image','inspect','bobuy/frontend:'+RELEASE]))[0]['Id'];print(json.dumps(before))
"""
  for key,value in [('REMOTE',REMOTE),('PAYLOAD_SHA',sha(payload)),('BASE_FRONT',BASE_FRONT),('BASE_CORE',BASE_CORE),('SOURCE',source),('RELEASE',RELEASE)]:code=code.replace(key,repr(value))
  data=json.loads(remote(code));write('staged.json',dict(data,source=source,payloadSha256=sha(payload)))
  write('frontend-files.json',{str(p.relative_to(ROOT/'frontend/dist')).replace('\\','/'):sha(p) for p in (ROOT/'frontend/dist').rglob('*') if p.is_file()})
  print('FRONTEND_IMAGE_STAGED_WITHOUT_ACTIVATION')
 elif action=='finalize':
  staged=json.loads((OUT/'staged.json').read_text());assert staged['source']==source
  ci=[v for v in json.loads(run(['gh','pr','checks','69','--json','name,state,link'])) if v['name'].startswith('analyze (')]
  assert len(ci)==3 and all(v['state']=='SUCCESS' for v in ci)
  pr=json.loads(run(['gh','pr','view','69','--json','headRefOid,mergeStateStatus']))
  assert pr['headRefOid']==source and pr['mergeStateStatus']=='CLEAN';write('ci.json',dict(source=source,checks=ci))
  frontend=json.loads((OUT/'frontend-gates.json').read_text());assert all(g['exitCode']==0 for g in frontend)
  browser=json.loads((OUT/'gallery-compiled-final.json').read_text(encoding='utf-8'));assert browser['result']=='PASS'
  visual=json.loads((OUT/'visual-acceptance.json').read_text());assert visual['result']=='PASS' and visual['source']==source
  gates=dict(source=source,result='PASS',ci='success',frontendTests='PASS',frontendBuild='PASS',realHttpBrowser='PASS',schemaUnchanged=33,rollback='Existing prior frontend image retained; compose snapshot restored by operator on failure; no database restore')
  write('gates.json',gates)
  a=dict(source=source,release=RELEASE,baseFrontend=staged['baseFrontend'],baseCore=staged['baseCore'],operatorSha256=sha(OUT/'frontend-operator.py'),gatesSha256=sha(OUT/'gates.json'),frontend=json.loads((OUT/'frontend-files.json').read_text()),images=[dict(name='frontend',tag='bobuy/frontend:'+RELEASE,imageId=staged['imageId'])]);write('artifact.json',a)
  for name in ['gates.json','artifact.json']:run(SCP+[str(OUT/name),'root@185.184.223.41:'+REMOTE+'/'+name])
  print('SOURCE_CI_TESTS_BUILD_AND_RECOVERY_BOUND')
 elif action in ['activate','verify']:
  for phase in (['prepare','activate'] if action=='activate' else ['verify']):print(run(SSH+['flock -n /opt/bobuy/releases/engagement-global.lock python3 '+REMOTE+'/frontend-operator.py '+phase]))
  write('production-'+action+'.json',json.loads(remote("from pathlib import Path\nprint(Path('"+REMOTE+"/status.json').read_text())")))
 else:raise SystemExit('stage/finalize/activate/verify')
if __name__=='__main__':main()
