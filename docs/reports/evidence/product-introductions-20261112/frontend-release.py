from pathlib import Path
import importlib.util,json,tarfile,shutil,sys
spec=importlib.util.spec_from_file_location('client',Path(__file__).with_name('release-client.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ROOT=m.ROOT;E=m.E/'currency-final';E.mkdir(exist_ok=True)
RELEASE='20261112.product-introductions-currency';REMOTE='/opt/bobuy/releases/'+RELEASE
SOURCE=m.run(['git','rev-parse','HEAD']);BASE='5a9bb64ab8cda965018bddacfe9471c1081ca34b'
def write(n,v):(E/n).write_text(json.dumps(v,indent=2),encoding='utf-8')
def main():
 action=sys.argv[1]
 if action=='build':
  assert 'Generated home-only crawlable HTML' in (m.E/'frontend-currency-build.log').read_text()
  operator=(ROOT/'docs/reports/evidence/social-platform-select-20261112/frontend-operator.py').read_text().replace('20261112.social-platform-select.2',RELEASE).replace('Publish the accepted account layout','Publish the accepted product introduction currency layout').replace('http://127.0.0.1/account','http://127.0.0.1/products')
  (E/'frontend-operator.py').write_text(operator,encoding='utf-8')
  temp=ROOT/'.task-tmp/frontend-currency';temp.mkdir(parents=True,exist_ok=True)
  (temp/'Dockerfile').write_text('FROM nginx@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d\nCOPY frontend /usr/share/nginx/html\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\n')
  with tarfile.open(temp/'payload.tar.gz','w:gz') as tar:
   tar.add(ROOT/'frontend/dist',arcname='frontend');tar.add(ROOT/'frontend/nginx.conf',arcname='nginx.conf');tar.add(temp/'Dockerfile',arcname='Dockerfile')
  m.remote("from pathlib import Path\np=Path('"+REMOTE+"');assert not p.exists();p.mkdir(mode=0o700)")
  for p in [temp/'payload.tar.gz',E/'frontend-operator.py']:m.run(m.SCP+[str(p),'root@185.184.223.41:'+REMOTE+'/'+p.name])
  code="""from pathlib import Path
import hashlib,tarfile,subprocess,json
p=Path('%s');assert hashlib.sha256((p/'payload.tar.gz').read_bytes()).hexdigest()=='%s'
with tarfile.open(p/'payload.tar.gz') as tar:
 for v in tar.getmembers():assert not v.issym() and not v.islnk() and (p/v.name).resolve().is_relative_to(p)
 tar.extractall(p,filter='data')
with (p/'build.log').open('w') as log:subprocess.run(['docker','build','--network=none','--label','org.opencontainers.image.revision=%s','-t','bobuy/frontend:%s',str(p)],check=True,stdout=log,stderr=subprocess.STDOUT)
def state(n):
 d=json.loads(subprocess.check_output(['docker','inspect',n]))[0];return dict(image=d['Image'],tag=d['Config']['Image'],revision=d['Config']['Labels'].get('org.opencontainers.image.revision'))
value=dict(baseFrontend=state('bobuy-frontend'),baseCore=state('bobuy-core-service'),imageId=json.loads(subprocess.check_output(['docker','image','inspect','bobuy/frontend:%s']))[0]['Id']);assert value['baseFrontend']['revision']==value['baseCore']['revision']=='%s';print(json.dumps(value))
"""%(REMOTE,m.sha(temp/'payload.tar.gz'),SOURCE,RELEASE,RELEASE,BASE)
  data=json.loads(m.remote(code));write('staged.json',data)
  write('frontend-files.json',{str(p.relative_to(ROOT/'frontend/dist')).replace('\\','/'):m.sha(p) for p in (ROOT/'frontend/dist').rglob('*') if p.is_file()});print(json.dumps(dict(source=SOURCE,imageId=data['imageId'])))
 elif action=='finalize':
  ci=json.loads(m.run(['gh','run','view','43148111847','--json','status,conclusion,headSha,url']));assert ci['headSha']==SOURCE and ci['conclusion']=='success';write('ci.json',ci)
  gates=dict(source=SOURCE,result='PASS',ci='success',ciUrl=ci['url'],frontendTests=89,testsReused='JavaScript and test inputs unchanged by CSS-only correction',frontendBuild='PASS',candidateBrowser='PASS: Japanese360px actual compiled layout with production public facts; JPY remains one line')
  write('gates.json',gates);data=json.loads((E/'staged.json').read_text());a=dict(source=SOURCE,release=RELEASE,baseFrontend=data['baseFrontend'],baseCore=data['baseCore'],operatorSha256=m.sha(E/'frontend-operator.py'),gatesSha256=m.sha(E/'gates.json'),frontend=json.loads((E/'frontend-files.json').read_text()),images=[dict(name='frontend',tag='bobuy/frontend:'+RELEASE,imageId=data['imageId'])]);write('artifact.json',a)
  for n in ['gates.json','artifact.json']:m.run(m.SCP+[str(E/n),'root@185.184.223.41:'+REMOTE+'/'+n])
  print('Frontend source and gates bound')
 elif action in ('activate','verify'):
  for phase in (['prepare','activate'] if action=='activate' else ['verify']):print(m.run(m.SSH+['flock -n /opt/bobuy/releases/engagement-global.lock python3 '+REMOTE+'/frontend-operator.py '+phase]))
  v=json.loads(m.remote("from pathlib import Path\nprint(Path('"+REMOTE+"/status.json').read_text())"));write('production-'+action+'.json',v)
if __name__=='__main__':main()
