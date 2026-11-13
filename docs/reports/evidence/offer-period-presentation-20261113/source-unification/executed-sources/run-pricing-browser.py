from pathlib import Path
import subprocess,sys,json
sys.stdout.reconfigure(encoding='utf-8')
r=Path(__file__).parent
ssh=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41']
code="import json\nfrom pathlib import Path\nd=json.loads(Path('/etc/bobuy-admin.json').read_text());print(json.dumps({'username':d['username'],'password':d['password']}))"
secret=subprocess.check_output(ssh+['python3','-'],input=code.encode());p=subprocess.run(['node',*sys.argv[1:]],cwd=r,input=secret,capture_output=True);values=json.loads(secret);secret=b'';message=(p.stdout+p.stderr).decode(errors='replace')
for value in values.values():message=message.replace(value,'[redacted]')
values.clear();print(message);sys.exit(p.returncode)
