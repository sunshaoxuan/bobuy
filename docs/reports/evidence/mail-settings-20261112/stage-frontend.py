"""Stage a mail-page frontend artifact without activating any service."""
from pathlib import Path
import subprocess,json,hashlib,tarfile
E=Path(__file__).resolve().parent;ROOT=E.parents[3];T=ROOT/'.task-tmp/frontend-release';T.mkdir(parents=True,exist_ok=True)
RELEASE='20261112.mail-settings.3';REMOTE='/opt/bobuy/releases/'+RELEASE
SSH=['ssh','-i','C:/workspace/Secure/sunsxaws.pem','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','root@185.184.223.41']
SCP=['scp','-i','C:/workspace/Secure/sunsxaws.pem','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes']
def run(a,input=None):
 p=subprocess.run(a,input=input,capture_output=True,text=True,encoding='utf-8',errors='replace')
 if p.returncode:raise RuntimeError('Stage failed: '+p.stderr[-500:])
 return p.stdout.strip()
def remote(s):return run(SSH+['python3','-'],s)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source=run(['git','rev-parse','HEAD']);assert run(['git','diff','--name-only','HEAD','--','frontend'])==''
files={str(p.relative_to(ROOT/'frontend/dist')).replace('\\','/'):sha(p) for p in (ROOT/'frontend/dist').rglob('*') if p.is_file()}
(T/'Dockerfile').write_text('FROM nginx@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d\nCOPY frontend /usr/share/nginx/html\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\n')
with tarfile.open(T/'payload.tar.gz','w:gz') as tar:
 tar.add(ROOT/'frontend/dist',arcname='frontend');tar.add(ROOT/'frontend/nginx.conf',arcname='nginx.conf');tar.add(T/'Dockerfile',arcname='Dockerfile')
remote("from pathlib import Path\nimport shutil\np=Path('"+REMOTE+"');assert not p.exists();assert shutil.disk_usage('/opt/bobuy').free>1000000000;p.mkdir(mode=0o700)")
run(SCP+[str(T/'payload.tar.gz'),str(E/'frontend-release-operator.py'),'root@185.184.223.41:'+REMOTE+'/'])
s="""from pathlib import Path
import subprocess,json,hashlib
p=Path('%s')
subprocess.run(['tar','-xzf',str(p/'payload.tar.gz'),'-C',str(p)],check=True)
tag='bobuy/frontend:%s'
subprocess.run(['docker','build','--pull=false','--label','org.opencontainers.image.revision=%s','-t',tag,str(p)],check=True,stdout=(p/'build.log').open('w'),stderr=subprocess.STDOUT)
def inspect(a):return json.loads(subprocess.check_output(['docker',*a],text=True))[0]
c=inspect(['inspect','bobuy-frontend']);im=inspect(['image','inspect',tag])
print(json.dumps({'base':{'source':c['Config']['Labels'].get('org.opencontainers.image.revision'),'tag':c['Config']['Image'],'image':c['Image']},'image':{'name':'frontend','tag':tag,'imageId':im['Id']},'librarySha256':hashlib.sha256(Path('/opt/bobuy/releases/20261111.1/release_operator.py').read_bytes()).hexdigest()}))
"""%(REMOTE,RELEASE,source)
a=json.loads(remote(s));a.update({'source':source,'release':RELEASE,'frontend':files,'operatorSha256':sha(E/'frontend-release-operator.py')})
(E/'staged-artifact.json').write_text(json.dumps(a,indent=2));print(json.dumps({'source':source,'image':a['image'],'base':a['base'],'files':len(files)}))
