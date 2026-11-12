import subprocess,json,sys
script = r'''
import json,subprocess
from pathlib import Path
def request(base,path,token=None,payload=None):
    config=['silent','show-error','url = '+json.dumps(base+path)]
    if token: config.append('header = '+json.dumps('Authorization: Bearer '+token))
    if payload:
        config.extend(['header = "Content-Type: application/json"','data = '+json.dumps(json.dumps(payload))])
    raw=subprocess.check_output(['docker','exec','-i','bobuy-gateway-service','curl','--config','-','--write-out','\n%{http_code}'],input=('\n'.join(config)+'\n').encode())
    body,status=raw.rsplit(b'\n',1)
    return int(status),json.loads(body) if body.strip() else {}
credentials=json.loads(Path('/etc/bobuy-admin.json').read_text())
status,session=request('http://auth-service:8084','/api/auth/login',payload={k:credentials[k] for k in ('username','password')})
assert status==200,'login failed'
token=session.get('data',session)['accessToken']
result=[]
for service,port in [('core-service',8081),('ai-service',8082),('gateway-service',8080)]:
    for path in ['/api/ai/costco-onboarding','/api/ai/costco-onboarding/status']:
        status,body=request('http://'+service+':'+str(port),path,token)
        data=body.get('data')
        result.append(dict(service=service,path=path,status=status,dataType=type(data).__name__,workerEnabled=data.get('workerEnabled') if isinstance(data,dict) else None,errorCode=body.get('errorCode')))
for path in ['/api/ai/costco-onboarding','/api/ai/costco-onboarding/status']:
    status,body=request('http://gateway-service:8080',path)
    result.append(dict(service='gateway-service',authenticated=False,path=path,status=status,errorCode=body.get('errorCode')))
print(json.dumps(result))
'''
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41','python3 -'],input=script,text=True,capture_output=True,encoding='utf-8')
if result.returncode: raise RuntimeError('Remote probe failed: '+result.stderr)
print(result.stdout)
Path = __import__('pathlib').Path
Path(__file__).with_name('runtime-'+(sys.argv[1] if len(sys.argv)>1 else 'probe')+'.json').write_text(result.stdout)
