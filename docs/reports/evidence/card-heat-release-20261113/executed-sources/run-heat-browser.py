from pathlib import Path
import subprocess,json,sys
root=Path(__file__).parent
ssh=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41']
code="import json\nfrom pathlib import Path\nd=json.loads(Path('/etc/bobuy-admin.json').read_text());print(json.dumps({'username':d['username'],'password':d['password']}))"
secret=subprocess.check_output(ssh+['python3','-'],input=code.encode());p=subprocess.run(['node','verify-heat-release.mjs',*sys.argv[1:]],cwd=root,input=secret,capture_output=True);data=json.loads(secret);secret=b'';message=(p.stdout+p.stderr).decode(errors='replace')
for value in data.values():message=message.replace(value,'[redacted]')
data.clear();print(message);sys.exit(p.returncode)
