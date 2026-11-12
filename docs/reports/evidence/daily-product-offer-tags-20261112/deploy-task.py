"""Scoped transport and installation for this server background task only."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[4]
E=Path(__file__).resolve().parent
SSH=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41']
SCP=['scp','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem']
STAGE='/opt/bobuy/releases/20261112.offer-markers.1'
FILES=['scripts/sync-product-offer-markers.py','scripts/sync-product-offer-markers.sql',
       'infra/systemd/bobuy-offer-markers.service','infra/systemd/bobuy-offer-markers.timer']


def remote(code):
    p=subprocess.run(SSH+['python3','-'],input=code,capture_output=True,text=True,encoding='utf-8',timeout=180)
    if p.returncode:raise RuntimeError(p.stderr[-1500:])
    return p.stdout.strip()


def main():
    action=sys.argv[1]
    hashes={Path(name).name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in FILES}
    common="""import hashlib,json,os,shutil,subprocess
from pathlib import Path
os.umask(0o077)
def run(*args):return subprocess.check_output(args,text=True,stderr=subprocess.PIPE).strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
stage=Path(%r)
expected=%r
"""%(STAGE,hashes)
    if action=='stage':
        print(remote(common+"assert not (stage/'installed.json').exists();stage.mkdir(mode=0o700,parents=True,exist_ok=True);print('stage ready')"))
        for name in FILES:
            subprocess.run(SCP+[str(ROOT/name),'root@185.184.223.41:'+STAGE+'/'+Path(name).name],check=True,capture_output=True)
        value=json.loads(remote(common+"""
assert {n:sha(stage/n) for n in expected}==expected
run('python3','-m','py_compile',str(stage/'sync-product-offer-markers.py'))
run('systemd-analyze','verify',str(stage/'bobuy-offer-markers.service'),str(stage/'bobuy-offer-markers.timer'))
calendar=run('systemd-analyze','calendar','*-*-* 01:00:00 Asia/Tokyo')
print(json.dumps(dict(result='PASS',hashes=expected,calendar=calendar)))
"""))
        (E/'staged.json').write_text(json.dumps(value,indent=2),encoding='utf-8');print(json.dumps(value))
    elif action=='dry-run':
        value=json.loads(remote(common+"""
assert {n:sha(stage/n) for n in expected}==expected
print(run('python3',str(stage/'sync-product-offer-markers.py'),'--dry-run'))
"""))
        (E/'production-dry-run.json').write_text(json.dumps(value,indent=2),encoding='utf-8');print(json.dumps(value))
    elif action=='install':
        source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
        value=json.loads(remote(common+"source="+repr(source)+"\n"+"""
assert {n:sha(stage/n) for n in expected}==expected
assert not (stage/'installed.json').exists()
targets={n:Path('/opt/bobuy/scripts')/n if n.endswith(('.py','.sql')) else Path('/etc/systemd/system')/n for n in expected}
assert all(not p.exists() and not p.is_symlink() for p in targets.values())
before={n:json.loads(run('docker','inspect',n))[0]['Image'] for n in ['bobuy-core-service','bobuy-frontend','bobuy-postgres']}
for n,p in targets.items():
 shutil.copyfile(stage/n,p);p.chmod(0o644)
assert {n:sha(p) for n,p in targets.items()}==expected
run('systemctl','daemon-reload')
run('systemd-analyze','verify',str(targets['bobuy-offer-markers.service']),str(targets['bobuy-offer-markers.timer']))
run('systemctl','start','bobuy-offer-markers.service')
first=json.loads(Path('/var/lib/bobuy-offer-markers/latest.json').read_text())
assert first['sqlSha256']==expected['sync-product-offer-markers.sql'] and not first['dryRun']
run('systemctl','start','bobuy-offer-markers.service')
second=json.loads(Path('/var/lib/bobuy-offer-markers/latest.json').read_text())
assert second['added']==0 and second['removed']==0 and second['definitionsCreated']==0 and not second['dryRun']
run('systemctl','enable','--now','bobuy-offer-markers.timer')
assert run('systemctl','is-active','bobuy-offer-markers.timer')=='active'
assert run('systemctl','is-enabled','bobuy-offer-markers.timer')=='enabled'
assert {n:json.loads(run('docker','inspect',n))[0]['Image'] for n in before}==before
value=dict(result='PASS',source=source,hashes=expected,first=first,second=second,
 timer=run('systemctl','show','bobuy-offer-markers.timer','-p','NextElapseUSecRealtime','-p','LastTriggerUSec','-p','TimersCalendar','-p','ActiveState'),
 service=run('systemctl','show','bobuy-offer-markers.service','-p','Result','-p','ExecMainStatus'),applicationImagesUnchanged=before)
(stage/'installed.json').write_text(json.dumps(value,indent=2))
print(json.dumps(value))
"""))
        (E/'installed.json').write_text(json.dumps(value,indent=2),encoding='utf-8')
        print(json.dumps({k:v for k,v in value.items() if k not in ('first','second')}))
        print(json.dumps({key:{k:v for k,v in value[key].items() if k!='changes'} for key in ('first','second')}))
    else:raise SystemExit('Expected stage, dry-run or install')


if __name__=='__main__':main()
