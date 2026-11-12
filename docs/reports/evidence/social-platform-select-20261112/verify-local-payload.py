"""Bind the leftover local package to this task's final released frontend."""
from pathlib import Path
import hashlib,json,tarfile
e=Path(__file__).resolve().parent
root=e.parents[3]
artifact=json.loads((e/'artifact.json').read_text(encoding='utf-8'))
assert artifact['source']=='ec24fa9af47b38999b98fc848e8ccf77787ddad2'
temp=root/'.task-tmp/account-balance-20261112'
assert {p.name for p in temp.iterdir()}=={'payload.tar.gz','Dockerfile'}
with tarfile.open(temp/'payload.tar.gz','r:gz') as tar:
    actual={m.name.removeprefix('frontend/'):hashlib.sha256(tar.extractfile(m).read()).hexdigest() for m in tar.getmembers() if m.isfile() and m.name.startswith('frontend/')}
    assert actual==artifact['frontend']
    assert tar.extractfile('Dockerfile').read()==(temp/'Dockerfile').read_bytes()
    assert tar.extractfile('nginx.conf').read()==(root/'frontend/nginx.conf').read_bytes()
result={'source':artifact['source'],'result':'PASS','frontendFiles':len(actual),'payloadSha256':hashlib.sha256((temp/'payload.tar.gz').read_bytes()).hexdigest(),'dockerfileSha256':hashlib.sha256((temp/'Dockerfile').read_bytes()).hexdigest()}
(e/'local-payload-binding.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
