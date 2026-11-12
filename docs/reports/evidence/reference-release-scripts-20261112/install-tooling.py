"""Install only the accepted publisher/helper on the existing node, no release activation."""
import base64
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
FILES = ('publish-production.py', 'reference_data_release.py')
payload = {'source': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
           'beforePublisher': '655140da83732409f6ebf4970dddc0fac142bbcc15891c9685239927e9bb2f22',
           'files': {}}
for name in FILES:
    data = (ROOT / 'scripts' / name).read_bytes()
    committed = subprocess.check_output(['git', 'show', 'HEAD:scripts/' + name], cwd=ROOT)
    if data.replace(b'\r\n', b'\n') != committed:
        raise RuntimeError('Install only committed exact script bytes')
    data = committed
    payload['files'][name] = {'sha256': hashlib.sha256(data).hexdigest(),
                             'data': base64.b64encode(data).decode()}

REMOTE = r'''
import ast,base64,hashlib,json,os,pathlib,subprocess
root=pathlib.Path('/opt/bobuy')
scripts=root/'scripts'
stage=root/'releases/20261112.reference_release_tooling.1'
def sha(data): return hashlib.sha256(data).hexdigest()
def state():
    ids=subprocess.check_output(['docker','ps','-aq','--no-trunc'],text=True).split()
    return subprocess.check_output(['docker','inspect','--format',
      '{{.Id}} {{.Name}} {{.Image}} {{.State.Status}} {{.State.StartedAt}}',*ids],text=True).splitlines()
def installed():
    return {name:sha((scripts/name).read_bytes()) for name in PAYLOAD['files']}
if stage.exists():
    receipt=json.loads((stage/'receipt.json').read_text())
    if receipt['result']!='PASS' or installed()!=receipt['installed']:
        raise RuntimeError('Prior tooling installation requires inspection')
    print(json.dumps(receipt)); raise SystemExit(0)
for process in pathlib.Path('/proc').iterdir():
    if not process.name.isdigit(): continue
    try: args=(process/'cmdline').read_bytes().split(b'\0')
    except (FileNotFoundError,PermissionError,ProcessLookupError): continue
    if any(arg.endswith(b'/publish-production.py') or arg==b'publish-production.py' for arg in args):
        raise RuntimeError('Publisher is running; leave its inputs unchanged')
if sha((scripts/'publish-production.py').read_bytes())!=PAYLOAD['beforePublisher']:
    raise RuntimeError('Installed publisher changed since investigation')
if (scripts/'reference_data_release.py').exists():
    raise RuntimeError('Unexpected existing reference helper')
data={}
for name,item in PAYLOAD['files'].items():
    content=base64.b64decode(item['data'])
    if sha(content)!=item['sha256']: raise RuntimeError('Transport hash mismatch')
    ast.parse(content,filename=name)
    target=scripts/name
    if target.is_symlink() or target.resolve().parent!=scripts.resolve(): raise RuntimeError('Unexpected script target')
    data[name]=content
before=state()
stage.mkdir(mode=0o700)
original=(scripts/'publish-production.py').read_bytes()
mode=(scripts/'publish-production.py').stat().st_mode & 0o777
(stage/'publish-production.before.py').write_bytes(original)
result={'result':'INSTALLING','source':PAYLOAD['source'],'beforePublisher':sha(original),
        'backup':str(stage/'publish-production.before.py'),'servicesChanged':False,
        'databaseCommandsExecuted':False,'historicalOperatorsChanged':False}
(stage/'receipt.json').write_text(json.dumps(result,indent=2))
try:
    # Install the dependency first; atomically replace each script after byte checks.
    for name in ('reference_data_release.py','publish-production.py'):
        temporary=scripts/('.'+name+'.reference-tooling-new')
        with temporary.open('xb') as output: output.write(data[name])
        temporary.chmod(mode if name=='publish-production.py' else 0o644)
        os.replace(temporary,scripts/name)
    expected={name:item['sha256'] for name,item in PAYLOAD['files'].items()}
    if installed()!=expected: raise RuntimeError('Installed bytes differ')
    smoke=[]
    for options in ([],['--mode','maintenance'],['--mode','reference-data']):
        test=subprocess.run(['python3',str(scripts/'publish-production.py'),'20261112.999999',*options],capture_output=True,text=True)
        if test.returncode!=2: raise RuntimeError('No-side-effect CLI guard failed')
        smoke.append({'options':options,'exitCode':test.returncode})
    if (root/'releases/20261112.999999').exists(): raise RuntimeError('Guard created a release stage')
    after=state()
    if before!=after: raise RuntimeError('Concurrent runtime state change requires inspection')
    result.update(result='PASS',installed=expected,smoke=smoke,containerStateUnchanged=True,
                  containersBefore=before,containersAfter=after)
except Exception:
    temporary=scripts/'.publish-production.py.reference-tooling-rollback'
    temporary.write_bytes(original); temporary.chmod(mode); os.replace(temporary,scripts/'publish-production.py')
    (scripts/'reference_data_release.py').unlink(missing_ok=True)
    result.update(result='FAILED_SCRIPT_ROLLED_BACK')
    (stage/'receipt.json').write_text(json.dumps(result,indent=2)+'\n')
    raise
(stage/'receipt.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
'''
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    '-i', 'C:/workspace/Secure/sunsxaws.pem', 'root@185.184.223.41', 'python3', '-'],
    input=('PAYLOAD = ' + repr(payload) + '\n' + REMOTE).encode(), capture_output=True, check=True)
receipt = json.loads(result.stdout)
(OUT / 'installed.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key:receipt[key] for key in ('result','source','installed','containerStateUnchanged',
    'servicesChanged','databaseCommandsExecuted')}))
