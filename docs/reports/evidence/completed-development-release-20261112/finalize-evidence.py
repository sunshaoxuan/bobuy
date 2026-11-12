"""Validate local archive structure, final acceptance identities and retained evidence bytes."""
from pathlib import Path
import hashlib,json,re,subprocess
out=Path(__file__).resolve().parent;root=out.parents[3]
read=lambda name:json.loads((out/name).read_text(encoding='utf-8-sig'))
assert read('production-browser.json')['result']=='PASS'
assert read('gallery-compiled-final.json')['result']=='PASS'
assert read('frontend-tests.json')['numPassedTests']==811 and read('frontend-tests.json')['numFailedTests']==0
assert read('production-verify.json')['source']==read('artifact.json')['source']=='c3bb160c7a8f0541b06089e2a3eacca05008198d'
before=read('runtime-preflight.json');after=read('runtime-final.json')
for name,state in before['containers'].items():
 if name!='bobuy-frontend':assert after['containers'][name]==state,name
assert after['containers']['bobuy-frontend']['image']==read('artifact.json')['images'][0]['imageId']
assert before['schema']==after['schema']
assert not after['releaseProcesses'] and not after['releaseLocks']
assert read('local-qa-cleanup.json')['result']=='PASS'
cleanup=read('cleanup-final.json');cleanup['protectedContainerCount']=len(read('local-qa-binding.json')['protectedContainers'])
(out/'cleanup-final.json').write_text(json.dumps(cleanup,indent=2)+'\n',encoding='utf-8')
for name in ['.task-tmp/completed-release','frontend/dist','frontend/node_modules']:assert not (root/name).exists()
log=out/'local-qa-startup.log'
if log.exists():
 (out/'local-qa-startup.txt').write_bytes(log.read_bytes());log.unlink()
for p in out.rglob('*'):
 if p.is_file() and p.suffix in ['.json','.txt','.py','.mjs','.ps1','.md','.patch']:
  text=p.read_text(encoding='utf-8-sig')
  assert not re.search(r'\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b',text),p.name
  assert not re.search(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b',text),p.name
manifest={str(p.relative_to(out)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file() and p.name!='evidence-manifest.json'}
(out/'evidence-manifest.json').write_text(json.dumps(dict(result='PASS',files=manifest,notes='Exact raw external replies/patches retain source whitespace; no secret values, temporary credentials or local build cache archived.'),indent=2)+'\n',encoding='utf-8')
print('FINAL_ACCEPTANCE_AND_ARCHIVE_VALIDATED: '+str(len(manifest))+' files')
