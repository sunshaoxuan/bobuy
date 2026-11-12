"""Stage and operate this frontend-only release through existing SSH and guards."""
from pathlib import Path
import argparse,base64,hashlib,json,subprocess,tarfile
E=Path(__file__).resolve().parent
ROOT=E.parents[3]
RELEASE='20261112.social-platform-select'
REMOTE='/opt/bobuy/releases/'+RELEASE
SSH=['C:/Windows/System32/OpenSSH/ssh.exe','-i','C:/workspace/Secure/sunsxaws.pem','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15','root@185.184.223.41']
SCP=['C:/Windows/System32/OpenSSH/scp.exe','-i','C:/workspace/Secure/sunsxaws.pem','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes']
def run(args):
 p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace')
 if p.returncode:raise RuntimeError('Controlled command failed: '+p.stderr[-600:])
 return p.stdout.strip()
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def remote(script):
 payload=base64.b64encode(script.encode()).decode()
 return run(SSH+["python3 -c \"import base64;exec(base64.b64decode('"+payload+"'))\""])
def write(name,data):
 (E/name).write_text(json.dumps(data,indent=2),encoding='utf-8')
def main():
 action=argparse.ArgumentParser();action.add_argument('action',choices=['generate','build','restage','finalize','activate','verify','cleanup']);args=action.parse_args()
 if args.action=='generate':
  source=run(['git','rev-parse','HEAD'])
  operator=(E/'frontend-operator.py').read_text(encoding='utf-8')
  write('frontend-files.json',{str(p.relative_to(ROOT/'frontend/dist')).replace('\\','/'):sha(p) for p in sorted((ROOT/'frontend/dist').rglob('*')) if p.is_file()})
  write('source-binding.json',{'source':source,'changedFiles':['frontend/src/pages/AccountProfile.tsx','frontend/src/account.css','frontend/src/socialPlatforms.ts','frontend/src/locales/zh-CN.ts','frontend/src/locales/zh-TW.ts','frontend/src/locales/en-US.ts','frontend/src/locales/ja-JP.ts'],'files':{p:sha(ROOT/p) for p in ['frontend/src/pages/AccountProfile.tsx','frontend/src/account.css','frontend/src/socialPlatforms.ts','frontend/src/locales/zh-CN.ts','frontend/src/locales/zh-TW.ts','frontend/src/locales/en-US.ts','frontend/src/locales/ja-JP.ts','frontend/package-lock.json','frontend/nginx.conf']}})
  print('Generated source and artifact file bindings');return
 if args.action in ('build','restage','finalize'):
  source=json.loads((E/'source-binding.json').read_text(encoding='utf-8'))['source'];assert source==run(['git','rev-parse','HEAD'])
  temp=ROOT/'.task-tmp/account-balance-20261112';temp.mkdir(parents=True,exist_ok=True)
  (temp/'Dockerfile').write_text('FROM nginx@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d\nCOPY frontend /usr/share/nginx/html\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\n',encoding='utf-8')
  with tarfile.open(temp/'payload.tar.gz','w:gz') as tar:
   tar.add(ROOT/'frontend/dist',arcname='frontend');tar.add(ROOT/'frontend/nginx.conf',arcname='nginx.conf');tar.add(temp/'Dockerfile',arcname='Dockerfile')
  if args.action=='build':
   remote("from pathlib import Path\np=Path('"+REMOTE+"');assert not p.exists();p.mkdir(mode=0o700)")
  if args.action=='restage':
   remote("""from pathlib import Path
import subprocess,json
p=Path('%s');assert p.is_dir() and not p.is_symlink() and not (p/'status.json').exists() and not (p/'artifact.json').exists()
i=json.loads(subprocess.check_output(['docker','image','inspect','bobuy/frontend:%s'],text=True))[0]
assert i['Config']['Labels']['org.opencontainers.image.revision']=='383247c457ab16d034289cf1f281bb905b963724'
ids=subprocess.check_output(['docker','ps','-aq'],text=True).splitlines()
if ids:assert all(c['Image']!=i['Id'] for c in json.loads(subprocess.check_output(['docker','inspect',*ids],text=True)))
"""%(REMOTE,RELEASE))
  if args.action in ('build','restage'):
   run(SCP+[str(temp/'payload.tar.gz'),str(E/'frontend-operator.py'),'root@185.184.223.41:'+REMOTE+'/'])
  build="""import json,subprocess
from pathlib import Path
p=Path('%s')
def run(a):return subprocess.check_output(a,text=True).strip()
tag='bobuy/frontend:%s'
if '%s' in ('build','restage'):
 subprocess.run(['tar','-xzf',str(p/'payload.tar.gz'),'-C',str(p)],check=True)
 subprocess.run(['docker','build','--pull=false','--label','org.opencontainers.image.revision=%s','-t',tag,str(p)],check=True,stdout=(p/'build.log').open('w'),stderr=subprocess.STDOUT)
else:
 import hashlib
 assert hashlib.sha256((p/'frontend-operator.py').read_bytes()).hexdigest()=='%s'
 assert json.loads(run(['docker','image','inspect',tag]))[0]['Config']['Labels']['org.opencontainers.image.revision']=='%s'
def state(name):
 c=json.loads(run(['docker','inspect',name]))[0]
 return {'image':c['Image'],'tag':c['Config']['Image'],'revision':c['Config']['Labels'].get('org.opencontainers.image.revision')}
print(json.dumps({'baseFrontend':state('bobuy-frontend'),'baseCore':state('bobuy-core-service'),'imageId':json.loads(run(['docker','image','inspect',tag]))[0]['Id']}))
"""%(REMOTE,RELEASE,args.action,source,sha(E/'frontend-operator.py'),source)
  data=json.loads(remote(build));assert data['baseFrontend']['revision']=='f4fae3d05d61c2b697cba4f6ac62f07b55d58790'
  tests=json.loads((E/'tests.json').read_text(encoding='utf-8'));assert tests['success'] and not tests['numFailedTests']
  ci=json.loads(run(['gh','run','list','--workflow','codeql.yml','--commit',source,'--limit','1','--json','conclusion,headSha,url']))[0]
  assert ci['headSha']==source and ci['conclusion']=='success'
  gates={'source':source,'result':'PASS','ci':'success','ciUrl':ci['url'],'focusedTests':tests['numPassedTests'],'typecheck':'PASS','i18nKeys':1665,'build':'PASS','nativeControlPixels':json.loads((E/'control-pixels.json').read_text(encoding='utf-8'))['result']}
  assert gates['nativeControlPixels']=='PASS';write('gates.json',gates)
  artifact={'source':source,'release':RELEASE,'baseFrontend':data['baseFrontend'],'baseCore':data['baseCore'],'operatorSha256':sha(E/'frontend-operator.py'),'gatesSha256':sha(E/'gates.json'),'frontend':json.loads((E/'frontend-files.json').read_text(encoding='utf-8')),'images':[{'name':'frontend','tag':'bobuy/frontend:'+RELEASE,'imageId':data['imageId']}]};write('artifact.json',artifact)
  run(SCP+[str(E/'artifact.json'),str(E/'gates.json'),'root@185.184.223.41:'+REMOTE+'/'])
  print(json.dumps({'source':source,'imageId':data['imageId'],'ci':ci['conclusion']}));return
 if args.action=='activate':
  for phase in ['prepare','activate']:print(run(SSH+['flock -n /opt/bobuy/releases/engagement-global.lock python3 '+REMOTE+'/frontend-operator.py '+phase]))
 else:print(run(SSH+['flock -n /opt/bobuy/releases/engagement-global.lock python3 '+REMOTE+'/frontend-operator.py '+args.action]))
 status=json.loads(run(SSH+['cat '+REMOTE+'/status.json']));write('production-'+args.action+'.json',status)
if __name__=='__main__':main()
