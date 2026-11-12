import importlib.util,json,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('client',Path(__file__).with_name('geographic-release-client.py'));client=importlib.util.module_from_spec(spec);spec.loader.exec_module(client)
secret=json.loads(client.remote("import json\nfrom pathlib import Path\nd=json.loads(Path('/etc/bobuy-admin.json').read_text());print(json.dumps({'username':d['username'],'password':d['password']}))"))
p=subprocess.run(['node',str(root/'tools/verify-geo-nav.mjs'),*sys.argv[1:]],cwd=root,input=json.dumps(secret).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
message=p.stderr.decode(errors='replace')
for value in secret.values():message=message.replace(value,'[redacted]')
secret.clear()
if p.returncode:raise RuntimeError(message[-1800:])
print('Navigation viewport checks PASS.')
