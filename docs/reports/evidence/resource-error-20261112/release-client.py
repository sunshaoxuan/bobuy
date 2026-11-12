from pathlib import Path
import subprocess,sys,json,hashlib,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[4]
e=root/'docs/reports/evidence/resource-error-20261112'
options=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem']
target='root@185.184.223.41'
stage='/opt/bobuy/releases/20261112.onboarding-route'
action=sys.argv[1]
def remote(command):
    return subprocess.check_output(['ssh',*options,target,command],text=True,encoding='utf-8')
if action=='stage':
    binding=json.loads((e/'binding.json').read_text())
    ci=json.loads(subprocess.check_output(['gh','run','view','43136750389','--json','headSha,status,conclusion,jobs,url'],cwd=root,text=True,encoding='utf-8'))
    assert ci['headSha']==binding['source'] and ci['status']=='completed' and ci['conclusion']=='success'
    (e/'ci.json').write_text(json.dumps(ci,indent=2))
    suites=[ET.parse(p).getroot() for p in (root/'bobbuy-gateway/target/surefire-reports').glob('TEST-*.xml')]
    tests={key:sum(int(s.attrib[key]) for s in suites) for key in ['tests','failures','errors','skipped']}
    assert tests==dict(tests=6,failures=0,errors=0,skipped=0)
    tests.update(command='mvn -B -pl bobbuy-gateway test',source=binding['source'],sameGatewayInputsAfterMerge=True)
    (e/'gateway-tests.json').write_text(json.dumps(tests,indent=2))
    operator=e/'config-operator.py'
    compile(operator.read_bytes(),str(operator),'exec')
    assert hashlib.sha256(operator.read_bytes()).hexdigest()==binding['operatorSha256']
    config=root/'infra/nacos/config/gateway-service.yaml'
    assert hashlib.sha256(config.read_bytes()).hexdigest()==binding['configSha256']
    print(remote('test ! -e '+stage+' && mkdir -m 700 '+stage))
    for local,name in [(operator,'config-operator.py'),(e/'binding.json','binding.json'),(e/'ci.json','ci.json'),(config,'gateway-service.yaml')]:
        subprocess.run(['scp',*options,str(local),target+':'+stage+'/'+name],check=True)
    print('STAGED_CONFIG_ONLY')
elif action in ['prepare','apply','verify','rollback']:
    result=remote('python3 '+stage+'/config-operator.py '+action)
    json.loads(result)
    (e/(action+'.json')).write_text(result)
    print(result)
else: raise ValueError(action)
