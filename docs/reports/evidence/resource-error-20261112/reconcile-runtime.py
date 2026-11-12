from pathlib import Path
import subprocess,json
script=r'''
from pathlib import Path
import json,subprocess,hashlib,importlib.util,time
stage=Path('/opt/bobuy/releases/20261112.onboarding-route')
spec=importlib.util.spec_from_file_location('operator',stage/'config-operator.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
b=json.loads((stage/'before.json').read_text());current=m.runtime();binding=json.loads((stage/'binding.json').read_text());candidate=(stage/'gateway-service.yaml').read_bytes()
assert m.sha(candidate)==binding['configSha256']
assert m.canonical(m.read_remote())==m.canonical(candidate) and m.CONFIG.read_bytes()==candidate
changed=[name for name in b['runtime'] if b['runtime'][name]!=current.get(name)]
assert changed==['/bobuy-core-service'],changed
assert set(current)==set(b['runtime']) and m.protected()==b['protected']
name=changed[0];assert current[name]['image']==b['runtime'][name]['image'] and current[name]['restarts']==0
inspect=json.loads(m.run('docker','inspect','bobuy-core-service'))[0]
assert inspect['State']['Health']['Status']=='healthy'
mail=Path('/opt/bobuy/releases/20261112.mail-setup')
saved=json.loads((mail/'containers.before.json').read_text())
assert b['runtime'][name]['id'] in json.dumps(saved),'Mail baseline must identify the replaced Core'
assert (mail/'compose.after.yml').read_bytes()==Path('/opt/bobuy/compose.production.yml').read_bytes(),'Final Compose must match the mail operation'
print(json.dumps(dict(phase='CONFIG_AND_RUNTIME_RECONCILED',at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),configSha256=m.sha(candidate),changedServices=changed,coreImageUnchanged=True,coreHealthy=True,otherServicesUnchanged=True,protectedUnchanged=True,mailEvidenceExists=bool(saved),mailSnapshotShape=list(saved)[:4],oldCoreId=b['runtime'][name]['id'],newCoreId=current[name]['id'],coreImage=current[name]['image'],coreCreated=inspect['Created'])))
'''
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41','python3 -'],input=script,text=True,capture_output=True,encoding='utf-8')
if result.returncode:raise RuntimeError(result.stderr)
print(result.stdout)
Path(__file__).with_name('runtime-reconciled.json').write_text(result.stdout)
