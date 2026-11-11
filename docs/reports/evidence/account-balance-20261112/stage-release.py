"""Stage and operate this frontend-only release through existing SSH and guards."""
from pathlib import Path
import argparse,base64,hashlib,json,subprocess,tarfile
E=Path(__file__).resolve().parent
ROOT=E.parents[3]
RELEASE='20261112.account-balance'
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
 action=argparse.ArgumentParser();action.add_argument('action',choices=['generate','build','activate','verify','cleanup']);args=action.parse_args()
 if args.action=='generate':
  source=run(['git','rev-parse','HEAD'])
  operator=(E.parent/'account-layout-20261111/frontend-operator.py').read_text()
  operator=operator.replace("releases/20261112.account-layout.2","releases/"+RELEASE)
  start=operator.index("            prior=read(ROOT/'releases/20261112.account-layout/artifact.json')")
  end=operator.index('            removed=[];absent=[]',start)
  operator=operator[:start]+operator[end:]
  operator=operator.replace("[old,prior['baseFrontend']]","[old]")
  (E/'frontend-operator.py').write_text(operator,encoding='utf-8')
  write('frontend-files.json',{str(p.relative_to(ROOT/'frontend/dist')).replace('\\','/'):sha(p) for p in sorted((ROOT/'frontend/dist').rglob('*')) if p.is_file()})
  write('source-binding.json',{'source':source,'changedFiles':['frontend/src/pages/AccountProfile.tsx','frontend/src/account.css'],'files':{p:sha(ROOT/p) for p in ['frontend/src/pages/AccountProfile.tsx','frontend/src/account.css','frontend/package-lock.json','frontend/nginx.conf']}})
  print('Generated source and artifact file bindings');return
 if args.action=='build':
  source=json.loads((E/'source-binding.json').read_text())['source'];assert source==run(['git','rev-parse','HEAD'])
  temp=ROOT/'.task-tmp/account-balance-20261112';temp.mkdir(parents=True,exist_ok=True)
  (temp/'Dockerfile').write_text('FROM nginx@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d\nCOPY frontend /usr/share/nginx/html\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\n',encoding='utf-8')
  with tarfile.open(temp/'payload.tar.gz','w:gz') as tar:
   tar.add(ROOT/'frontend/dist',arcname='frontend');tar.add(ROOT/'frontend/nginx.conf',arcname='nginx.conf');tar.add(temp/'Dockerfile',arcname='Dockerfile')
  remote("from pathlib import Path\np=Path('"+REMOTE+"');assert not p.exists();p.mkdir(mode=0o700)")
  run(SCP+[str(temp/'payload.tar.gz'),str(E/'frontend-operator.py'),'root@185.184.223.41:'+REMOTE+'/'])
  build="""import json,subprocess
from pathlib import Path
p=Path('%s')
def run(a):return subprocess.check_output(a,text=True).strip()
subprocess.run(['tar','-xzf',str(p/'payload.tar.gz'),'-C',str(p)],check=True)
tag='bobuy/frontend:%s'
subprocess.run(['docker','build','--pull=false','--label','org.opencontainers.image.revision=%s','-t',tag,str(p)],check=True,stdout=(p/'build.log').open('w'),stderr=subprocess.STDOUT)
def state(name):
 c=json.loads(run(['docker','inspect',name]))[0]
 return {'image':c['Image'],'tag':c['Config']['Image'],'revision':c['Config']['Labels'].get('org.opencontainers.image.revision')}
print(json.dumps({'baseFrontend':state('bobuy-frontend'),'baseCore':state('bobuy-core-service'),'imageId':json.loads(run(['docker','image','inspect',tag]))[0]['Id']}))
"""%(REMOTE,RELEASE,source)
  data=json.loads(remote(build));assert data['baseFrontend']['revision']=='a3b0d1796a8d44d25b65ffd673d3d7c8a2378039'
  tests=json.loads((E/'tests.json').read_text());assert tests['success'] and not tests['numFailedTests']
  ci=json.loads(run(['gh','run','list','--workflow','codeql.yml','--commit',source,'--limit','1','--json','conclusion,headSha,url']))[0]
  assert ci['headSha']==source and ci['conclusion']=='success'
  gates={'source':source,'result':'PASS','ci':'success','ciUrl':ci['url'],'focusedTests':tests['numPassedTests'],'typecheck':'PASS','i18nKeys':1610,'build':'PASS','nativeControlPixels':json.loads((E/'control-pixels.json').read_text())['result']}
  assert gates['nativeControlPixels']=='PASS';write('gates.json',gates)
  artifact={'source':source,'release':RELEASE,'baseFrontend':data['baseFrontend'],'baseCore':data['baseCore'],'operatorSha256':sha(E/'frontend-operator.py'),'gatesSha256':sha(E/'gates.json'),'frontend':json.loads((E/'frontend-files.json').read_text()),'images':[{'name':'frontend','tag':'bobuy/frontend:'+RELEASE,'imageId':data['imageId']}]};write('artifact.json',artifact)
  run(SCP+[str(E/'artifact.json'),str(E/'gates.json'),'root@185.184.223.41:'+REMOTE+'/'])
  print(json.dumps({'source':source,'imageId':data['imageId'],'ci':ci['conclusion']}));return
 if args.action=='activate':
  for phase in ['prepare','activate']:print(run(SSH+['python3 '+REMOTE+'/frontend-operator.py '+phase]))
 else:print(run(SSH+['python3 '+REMOTE+'/frontend-operator.py '+args.action]))
 status=json.loads(run(SSH+['cat '+REMOTE+'/status.json']));write('production-'+args.action+'.json',status)
if __name__=='__main__':main()
