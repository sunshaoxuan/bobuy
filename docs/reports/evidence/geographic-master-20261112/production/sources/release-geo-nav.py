"""Scoped frontend-only delivery. Uses the existing accepted frontend operator."""
import hashlib,importlib.util,json,subprocess,sys,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('client',Path(__file__).with_name('geographic-release-client.py'));client=importlib.util.module_from_spec(spec);spec.loader.exec_module(client)
OUT=client.E/'nav-release';OUT.mkdir(exist_ok=True)
RELEASE='20261112.geographic_nav.1';REMOTE='/opt/bobuy/releases/'+RELEASE
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(n,v):(OUT/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def main():
    action=sys.argv[1]
    if action=='publish':
        source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
        assert source=='f91681242ab688f25e39aa8481167f8fc0c8251a'
        ci=json.loads(subprocess.check_output(['gh','pr','view','72','--json','headRefOid,statusCheckRollup,url'],cwd=ROOT,text=True))
        assert ci['headRefOid']==source and all(v.get('conclusion') in ('SUCCESS','NEUTRAL') and v.get('status')=='COMPLETED' for v in ci['statusCheckRollup'])
        write('ci.json',ci)
        assert json.loads((client.E/'nav-candidate/acceptance.json').read_text(encoding='utf-8'))['result']=='PASS'
        assert 'Generated home-only crawlable HTML' in (ROOT/'.release-runtime/frontend-nav-build.log').read_text(encoding='utf-8',errors='replace')
        assert subprocess.check_output(['git','diff','--name-only','b3caeec','HEAD','--','frontend'],cwd=ROOT,text=True).splitlines()==['frontend/src/merchant.css']
        operator=(ROOT/'docs/reports/evidence/product-spec-localization-20261112/frontend-operator.py').read_text(encoding='utf-8').replace('20261112.product-fact-localization',RELEASE)
        (OUT/'frontend-operator.py').write_text(operator,encoding='utf-8',newline='\n')
        payload=ROOT/'.release-runtime/nav-payload.tar.gz';dockerfile=ROOT/'.release-runtime/Dockerfile.frontend'
        dockerfile.write_text('FROM nginx@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d\nCOPY frontend /usr/share/nginx/html\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\n',encoding='utf-8',newline='\n')
        with tarfile.open(payload,'w:gz') as tar:
            tar.add(ROOT/'frontend/dist',arcname='frontend');tar.add(ROOT/'frontend/nginx.conf',arcname='nginx.conf');tar.add(dockerfile,arcname='Dockerfile')
        client.remote("from pathlib import Path\np=Path('"+REMOTE+"');assert not p.exists();p.mkdir(mode=0o700)")
        for file in [payload,OUT/'frontend-operator.py']:subprocess.run(client.SCP+[str(file),'root@185.184.223.41:'+REMOTE+'/'+file.name],check=True,stdout=subprocess.DEVNULL)
        code='''from pathlib import Path
import hashlib,tarfile,json,subprocess
p=Path(REMOTE_VALUE);assert hashlib.sha256((p/'nav-payload.tar.gz').read_bytes()).hexdigest()==PAYLOAD_VALUE
with tarfile.open(p/'nav-payload.tar.gz') as tar:
 for v in tar.getmembers():assert not v.issym() and not v.islnk() and (p/v.name).resolve().is_relative_to(p)
 tar.extractall(p,filter='data')
def state(n):
 d=json.loads(subprocess.check_output(['docker','inspect',n]))[0];return dict(image=d['Image'],tag=d['Config']['Image'],revision=d['Config']['Labels'].get('org.opencontainers.image.revision'))
before=dict(baseFrontend=state('bobuy-frontend'),baseCore=state('bobuy-core-service'))
assert before['baseFrontend']['revision']==before['baseCore']['revision']=='b3caeec8c0b04a3144339f8e84ab334b53f81aa1'
with (p/'build.log').open('w') as log:subprocess.run(['docker','build','--network=none','--label','org.opencontainers.image.revision='+SOURCE_VALUE,'-t','bobuy/frontend:'+RELEASE_VALUE,str(p)],check=True,stdout=log,stderr=subprocess.STDOUT,timeout=120)
before['imageId']=json.loads(subprocess.check_output(['docker','image','inspect','bobuy/frontend:'+RELEASE_VALUE]))[0]['Id'];print(json.dumps(before))
'''
        code=code.replace('REMOTE_VALUE',repr(REMOTE)).replace('PAYLOAD_VALUE',repr(sha(payload))).replace('SOURCE_VALUE',repr(source)).replace('RELEASE_VALUE',repr(RELEASE))
        staged=json.loads(client.remote(code));write('staged.json',staged)
        gates=dict(source=source,result='PASS',ci='success',ciUrl=ci['url'],frontendBuild='PASS',sourceComparison='Only merchant.css changed; JavaScript/tests/dependencies unchanged from accepted source',candidateCssBrowser='PASS:1440x1000 and1440x800, native wheel, selected-link and identity bounds',databaseOperation=False)
        write('gates.json',gates)
        a=dict(source=source,release=RELEASE,baseFrontend=staged['baseFrontend'],baseCore=staged['baseCore'],operatorSha256=sha(OUT/'frontend-operator.py'),gatesSha256=sha(OUT/'gates.json'),frontend={p.relative_to(ROOT/'frontend/dist').as_posix():sha(p) for p in (ROOT/'frontend/dist').rglob('*') if p.is_file()},images=[dict(name='frontend',tag='bobuy/frontend:'+RELEASE,imageId=staged['imageId'])]);write('artifact.json',a)
        for name in ['gates.json','artifact.json']:subprocess.run(client.SCP+[str(OUT/name),'root@185.184.223.41:'+REMOTE+'/'+name],check=True,stdout=subprocess.DEVNULL)
        for phase in ['prepare','activate']:
            p=subprocess.run(client.SSH+['flock -n /opt/bobuy/releases/engagement-global.lock python3 '+REMOTE+'/frontend-operator.py '+phase],capture_output=True,timeout=180)
            if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1500:])
        value=json.loads(client.remote("from pathlib import Path\nprint(Path('"+REMOTE+"/status.json').read_text())"));write('production-activate.json',value);print(json.dumps(value))
    elif action=='verify':
        p=subprocess.run(client.SSH+['flock -n /opt/bobuy/releases/engagement-global.lock python3 '+REMOTE+'/frontend-operator.py verify'],capture_output=True,timeout=120)
        if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1500:])
        value=json.loads(client.remote("from pathlib import Path\nprint(Path('"+REMOTE+"/status.json').read_text())"));write('production-verify.json',value);print(json.dumps(value))
    else:raise ValueError(action)
if __name__=='__main__':main()
