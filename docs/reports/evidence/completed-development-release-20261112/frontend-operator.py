"""Publish the accepted verified gallery upload feedback by replacing only the frontend container."""
from pathlib import Path
import argparse,fcntl,hashlib,importlib.util,json,os,shutil,subprocess,time
ROOT=Path('/opt/bobuy');STAGE=ROOT/'releases/20261112.gallery-upload-feedback'
LIBRARY=ROOT/'releases/20261111.1/release_operator.py'
LIBRARY_SHA='5fddec223ef6f1d38402c8a11c1f99877ffc93f9d7d4b5afeb1271752c5610ac'
ROUTE_SHA='b099bf59589e5b297699324d265209a112ad5b3865c51d1f174c12a427e6b391'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text())
def run(*args):
    r=subprocess.run(args,text=True,capture_output=True,timeout=120)
    if r.returncode:raise RuntimeError('Controlled command failed; output suppressed')
    return r.stdout.strip()
def protected():return json.loads(run('python3',str(ROOT/'scripts/protected-node-state.py')))
def status(phase,**values):
    result=dict(phase=phase,at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**values)
    (STAGE/'status.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','activate','verify','cleanup']);args=parser.parse_args()
    assert os.geteuid()==0 and not ROOT.is_symlink() and not STAGE.is_symlink();os.umask(0o077)
    a=read(STAGE/'artifact.json');assert sha(Path(__file__))==a['operatorSha256'] and sha(LIBRARY)==LIBRARY_SHA
    assert sha(STAGE/'gates.json')==a['gatesSha256'];gates=read(STAGE/'gates.json')
    assert gates['result']=='PASS' and gates['ci']=='success' and gates['source']==a['source']
    assert sha(ROOT/'infra/nacos/config/gateway-service.yaml')==ROUTE_SHA
    spec=importlib.util.spec_from_file_location('accepted_release',LIBRARY);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    names=(*m.WRITERS,'frontend',*m.PROTECTED)
    def states():return {name:m.state(name) for name in names}
    def assets():
        container=json.loads(run('docker','inspect','bobuy-frontend'))[0]
        assert container['RestartCount']==0 and container['State']['Running']
        paths=sorted(a['frontend'])
        actual=run('docker','exec','bobuy-frontend','sha256sum',*['/usr/share/nginx/html/'+p for p in paths]).splitlines()
        assert [line.split()[0] for line in actual]==[a['frontend'][p] for p in paths]
        assert run('docker','exec','bobuy-frontend','wget','-q','-O','-','http://127.0.0.1/products').startswith('<!doctype html>')
        run('docker','exec','bobuy-frontend','nginx','-t')
    with (STAGE/'operator.lock').open('a+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        image=a['images'][0];assert len(a['images'])==1 and image['name']=='frontend'
        v=json.loads(run('docker','image','inspect',image['tag']))[0]
        assert v['Id']==image['imageId'] and v['Config']['Labels']['org.opencontainers.image.revision']==a['source']
        if args.action=='prepare':
            assert not (STAGE/'status.json').exists()
            before=states();assert all(s['health'] in ('running','healthy') for s in before.values())
            assert before['frontend']['image']==a['baseFrontend']['image'] and before['frontend']['tag']==a['baseFrontend']['tag']
            assert before['core-service']['image']==a['baseCore']['image']
            original=(ROOT/'compose.production.yml').read_text()
            (STAGE/'compose.before.yml').write_text(original)
            (STAGE/'compose.after.yml').write_text(m.rewrite_images(original,a['images'],before))
            (STAGE/'runtime.before.json').write_text(json.dumps(before,indent=2))
            (STAGE/'protected.before.json').write_text(json.dumps(protected(),indent=2))
            status('PREPARED',source=a['source'],frontendOnly=True);return
        before=read(STAGE/'runtime.before.json');baseline=read(STAGE/'protected.before.json')
        if args.action=='activate':
            assert read(STAGE/'status.json')['phase']=='PREPARED' and states()==before and protected()==baseline
            assert (ROOT/'compose.production.yml').read_text()==(STAGE/'compose.before.yml').read_text()
            try:
                shutil.copyfile(STAGE/'compose.after.yml',ROOT/'compose.production.yml');run(*m.compose(),'config','--quiet')
                run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','frontend');assets()
                for name in names:
                    if name!='frontend':assert m.state(name)==before[name]
                assert m.state('frontend')['image']==image['imageId'] and protected()==baseline
            except Exception:
                shutil.copyfile(STAGE/'compose.before.yml',ROOT/'compose.production.yml')
                run(*m.compose(),'up','-d','--no-deps','--no-build','--pull','never','frontend')
                status('FRONTEND_ROLLED_BACK',databaseUnchanged=True);raise
            (STAGE/'activated.json').write_text(json.dumps({'monotonic':time.monotonic(),'at':time.time()}))
            status('FRONTEND_LIVE',source=a['source'],frontendOnly=True,databaseWrites=False,protectedUnchanged=True);return
        assert read(STAGE/'status.json')['phase'] in ('FRONTEND_LIVE','VERIFIED','CLEANED')
        assets();current=states()
        assert current['frontend']['image']==image['imageId'] and current['frontend']['revision']==a['source']
        for name in names:
            if name!='frontend':assert current[name]==before[name]
        assert protected()==baseline
        if args.action=='cleanup':
            assert time.time()-read(STAGE/'activated.json')['at']>=120
            old=before['frontend'];assert old['tag']==a['baseFrontend']['tag'] and old['image']==a['baseFrontend']['image']
            removed=[];absent=[]
            for obsolete in [old]:
                tag=obsolete['tag'];digest=obsolete['image']
                assert tag.startswith('bobuy/frontend:') and digest!=image['imageId']
                containers=run('docker','ps','-aq').splitlines()
                if containers:assert all(c['Image']!=digest for c in json.loads(run('docker','inspect',*containers)))
                existing=run('docker','image','ls','--no-trunc','--filter','reference='+tag,'--format','{{.ID}}')
                if not existing:absent.append(tag);continue
                assert existing==digest
                run('docker','image','rm','--no-prune',tag);removed.append(tag)
            status('CLEANED',source=a['source'],removedOnly=removed,alreadyAbsent=absent,databaseUnchanged=True)
        else:status('VERIFIED',source=a['source'],frontendOnly=True,protectedUnchanged=True,databaseWrites=False)
if __name__=='__main__':main()
