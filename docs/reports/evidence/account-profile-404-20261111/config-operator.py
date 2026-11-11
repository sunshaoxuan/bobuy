"""Publish only the self-profile Nacos route. No business-data writes or image changes."""
from pathlib import Path
import argparse, hashlib, json, os, subprocess, time

ROOT = Path('/opt/bobuy')
STAGE = ROOT / 'releases/20261111.profile-route'
CONFIG = ROOT / 'infra/nacos/config/gateway-service.yaml'
URL = 'http://nacos:8848/nacos/v1/cs/configs'

def run(*args, data=None):
    result = subprocess.run(args, input=data, capture_output=True, timeout=60)
    if result.returncode: raise RuntimeError('Controlled command failed; output suppressed')
    return result.stdout

def canonical(value): return value.replace(b'\r\n', b'\n')
def sha(value): return hashlib.sha256(value).hexdigest()
def read_remote():
    return run('docker','exec','bobuy-gateway-service','curl','-fsS','--get',URL,
               '--data-urlencode','dataId=gateway-service.yaml','--data-urlencode','group=DEFAULT_GROUP')
def publish(value):
    assert run('docker','exec','-i','bobuy-gateway-service','curl','-fsS','-X','POST',URL,
               '--data-urlencode','dataId=gateway-service.yaml','--data-urlencode','group=DEFAULT_GROUP',
               '--data-urlencode','type=yaml','--data-urlencode','content@-',data=value).strip()==b'true'
def runtime():
    names=run('docker','ps','--filter','name=bobuy-','--format','{{.Names}}').decode().splitlines()
    values=json.loads(run('docker','inspect',*sorted(names)))
    return {v['Name']:{'id':v['Id'],'image':v['Image'],'restarts':v['RestartCount']} for v in values}
def protected(): return json.loads(run('python3',str(ROOT/'scripts/protected-node-state.py')))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','apply','rollback','verify'])
    args=parser.parse_args();assert os.geteuid()==0;os.umask(0o077)
    binding=json.loads((STAGE/'binding.json').read_text())
    candidate=(STAGE/'gateway-service.yaml').read_bytes()
    assert sha(candidate)==binding['configSha256']
    assert sha(Path(__file__).read_bytes())==binding['operatorSha256']
    if args.action=='prepare':
        assert not (STAGE/'before.json').exists()
        before=read_remote();source=CONFIG.read_bytes()
        assert canonical(before)==canonical(source)
        assert sha(canonical(before))==binding['baseConfigCanonicalSha256']
        assert canonical(candidate).count(b'id: self-profile-route')==1
        (STAGE/'nacos.before.yaml').write_bytes(before)
        (STAGE/'source.before.yaml').write_bytes(source)
        state={'runtime':runtime(),'protected':protected(),'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
        (STAGE/'before.json').write_text(json.dumps(state,indent=2))
        print(json.dumps({'phase':'PREPARED','source':binding['source'],'configSha256':sha(candidate)}));return
    baseline=json.loads((STAGE/'before.json').read_text())
    assert runtime()==baseline['runtime']
    assert protected()==baseline['protected']
    before=(STAGE/'nacos.before.yaml').read_bytes()
    if args.action=='apply':
        assert canonical(read_remote())==canonical(before)
        assert CONFIG.read_bytes()==(STAGE/'source.before.yaml').read_bytes()
        try:
            publish(candidate)
            assert canonical(read_remote())==canonical(candidate)
            CONFIG.write_bytes(candidate)
        except Exception:
            publish(before);CONFIG.write_bytes((STAGE/'source.before.yaml').read_bytes());raise
        result={'phase':'CONFIG_PUBLISHED','source':binding['source'],'configSha256':sha(candidate),
                'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'imagesChanged':False,'databaseWrites':False}
    elif args.action=='rollback':
        assert canonical(read_remote())==canonical(candidate)
        publish(before);CONFIG.write_bytes((STAGE/'source.before.yaml').read_bytes())
        result={'phase':'CONFIG_ROLLED_BACK','databaseUnchanged':True}
    else:
        assert canonical(read_remote())==canonical(candidate)
        assert CONFIG.read_bytes()==candidate
        result={'phase':'VERIFIED','source':binding['source'],'configSha256':sha(candidate),
                'containersUnchanged':True,'protectedUnchanged':True,
                'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
    assert runtime()==baseline['runtime'] and protected()==baseline['protected']
    (STAGE/(args.action+'.json')).write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
if __name__=='__main__':main()
