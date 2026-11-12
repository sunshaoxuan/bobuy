from pathlib import Path
import subprocess,json,hashlib,base64,tarfile,shutil,sys
ROOT=Path(__file__).resolve().parents[4]
E=ROOT/'docs/reports/evidence/product-introductions-20261112'
OLD=ROOT/'docs/reports/evidence/reference-display-20261112'
RELEASE='20261112.product-introductions.2'
REMOTE='/opt/bobuy/releases/'+RELEASE
SSH=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41']
SCP=['scp','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem']
LIBSHA='5fddec223ef6f1d38402c8a11c1f99877ffc93f9d7d4b5afeb1271752c5610ac'
def run(args):
 p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace')
 if p.returncode:raise RuntimeError('Scoped command failed: '+p.stderr[-500:])
 return p.stdout.strip()
def remote(code):
 return run(SSH+["python3 -c \"import base64;exec(base64.b64decode('"+base64.b64encode(code.encode()).decode()+"'))\""])
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,v): (E/name).write_text(json.dumps(v,indent=2),encoding='utf-8')
def main():
 action=sys.argv[1];source=run(['git','rev-parse','HEAD'])
 if action=='stage':
  temp=ROOT/'.task-tmp/release-payload';temp.mkdir(parents=True,exist_ok=True)
  shutil.copy2(ROOT/'bobbuy-core/target/bobbuy-core-0.1.0.jar',temp/'app.jar')
  shutil.copytree(ROOT/'frontend/dist',temp/'dist',dirs_exist_ok=True)
  shutil.copy2(ROOT/'frontend/nginx.conf',temp/'nginx.conf')
  (temp/'Dockerfile.core').write_text('FROM bobuy/core:20261112.reference-sort\nCOPY app.jar /app/app.jar\n')
  (temp/'Dockerfile.frontend').write_text('FROM nginx@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d\nCOPY dist /usr/share/nginx/html\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\n')
  files={str(p.relative_to(temp)).replace('\\','/'):sha(p) for p in temp.rglob('*') if p.is_file() and p.name not in ('payload.tar','payload.json')}
  (temp/'payload.json').write_text(json.dumps(dict(source=source,release=RELEASE,files=files)))
  with tarfile.open(temp/'payload.tar','w') as tar:
   for name in [*files,'payload.json']:tar.add(temp/name,arcname=name)
  operator=(OLD/'release-operator.py').read_text().replace('20261112.reference-display.4',RELEASE)
  # Retain the already shipped price assertions and add the actual introduction acceptance.
  needle="   assert card[0]['reference']['amount']==1498"
  assert needle in operator
  operator=operator.replace(needle,"   detail=json.loads(run('docker','exec','bobuy-core-service','curl','-fsS','http://127.0.0.1:8081/api/storefront/product-browse/0451e987-1bc1-498d-8494-a7b9be9adbb7'))['data']['item']\n   assert all(detail['introduction'].get(l) for l in ('ja-JP','zh-CN','zh-TW','en-US'))\n"+needle)
  (E/'release-operator.py').write_text(operator,encoding='utf-8')
  builder=(OLD/'build-stage.py').read_text().replace('20261112.reference-display.4',RELEASE).replace('f74912fbe4e3690921d9eb22cb84910dff3c78af088e64b860242a70f474bf62',sha(temp/'payload.tar')).replace('deac521fdb5c10e4accc2d4cc368fb494ab61801',source)
  (E/'build-stage.py').write_text(builder,encoding='utf-8')
  migration=(OLD/'verify-runtime-inputs.py').read_text().replace('20261112.reference-display.4',RELEASE)
  (E/'verify-runtime-inputs.py').write_text(migration,encoding='utf-8')
  remote("from pathlib import Path\np=Path('"+REMOTE+"');assert not (p/'artifact.staged.json').exists() and not (p/'status.json').exists();p.mkdir(mode=0o700,exist_ok=True)")
  for p in [temp/'payload.tar',E/'build-stage.py',E/'release-operator.py',E/'verify-runtime-inputs.py']:run(SCP+[str(p),'root@185.184.223.41:'+REMOTE+'/'+p.name])
  print(remote("from pathlib import Path\nimport shutil,hashlib,subprocess\np=Path('"+REMOTE+"');lib=Path('/opt/bobuy/releases/20261111.1/release_operator.py');assert hashlib.sha256(lib.read_bytes()).hexdigest()=='"+LIBSHA+"'\nshutil.copy2('/opt/bobuy/releases/20261112.reference-display.4/publisher_helpers.py',p/'publisher_helpers.py')\nsubprocess.run(['python3',str(p/'build-stage.py')],check=True)\nsubprocess.run(['python3',str(p/'verify-runtime-inputs.py')],check=True)"))
  write('source-binding.json',dict(source=source,release=RELEASE,payloadSha256=sha(temp/'payload.tar'),coreJarSha256=sha(temp/'app.jar'),frontend={k:v for k,v in files.items() if k.startswith('dist/')},backendEvidence='backend-final.log:671 reported,647 executed,24 skipped,0 failures/errors; inputs unchanged by main integration',frontendEvidence='frontend-accepted.log:89 passed,0 errors; frontend-integrated-build.log:PASS'))
 elif action=='stage-check':
  print(remote("from pathlib import Path\nimport json,subprocess\nstage=Path('"+REMOTE+"');a=json.loads((stage/'artifact.staged.json').read_text());assert a['source']=='"+source+"';assert not (stage/'status.json').exists();print(json.dumps(a['images']));subprocess.run(['python3',str(stage/'verify-runtime-inputs.py')],check=True)"))
  temp=ROOT/'.task-tmp/release-payload';payload=json.loads((temp/'payload.json').read_text())
  write('source-binding.json',dict(source=source,release=RELEASE,payloadSha256=sha(temp/'payload.tar'),coreJarSha256=sha(temp/'app.jar'),frontend={k:v for k,v in payload['files'].items() if k.startswith('dist/')},backendEvidence='backend-final.log:671 reported,647 executed,24 skipped,0 failures/errors; inputs unchanged by main integration',frontendEvidence='frontend-accepted.log:89 passed,0 errors; frontend-integrated-build.log:PASS'))
 elif action=='finalize':
  ci=json.loads(run(['gh','run','view','43145932918','--json','status,conclusion,headSha,url']))
  assert ci['headSha']==source and ci['conclusion']=='success' and ci['status']=='completed';write('ci.json',ci)
  gates=dict(source=source,result='PASS',backend=dict(tests=671,executed=647,skipped=24,failures=0,errors=0),configuredJacoco='PASS',frontendTests=89,frontendBuild='PASS',browser='PASS',browserScope='Four locales at1440 and360, normal synthetic master save and public readback; production acceptance pending',codeql='success',codeqlUrl=ci['url'],schemaOperation=False)
  write('gates.json',gates);run(SCP+[str(E/'gates.json'),'root@185.184.223.41:'+REMOTE+'/gates.json'])
  code="""from pathlib import Path
import json,hashlib,importlib.util
stage=Path('%s');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
library=Path('/opt/bobuy/releases/20261111.1/release_operator.py');assert sha(library)=='%s'
spec=importlib.util.spec_from_file_location('lib',library);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
base={n:m.state(n) for n in (*m.WRITERS,'frontend',*m.PROTECTED)}
assert base['core-service']['revision']=='a14f0320aeed077fbf449c95f2b236f4dd1d3393'
assert base['frontend']['revision']=='ec24fa9af47b38999b98fc848e8ccf77787ddad2'
assert all(v['health'] in ('healthy','running') for v in base.values())
assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='33'
g=json.loads((stage/'gates.json').read_text());a=json.loads((stage/'artifact.staged.json').read_text());assert a['source']==g['source']=='%s'
assert json.loads((stage/'migration-binding.json').read_text())['result']=='PASS'
a.update(base=base,librarySha256=sha(library),helperSha256=sha(stage/'publisher_helpers.py'),operatorSha256=sha(stage/'release-operator.py'),gatesSha256=sha(stage/'gates.json'),migrationBindingSha256=sha(stage/'migration-binding.json'),sqlMigration=False)
assert not (stage/'artifact.json').exists();(stage/'artifact.json').write_text(json.dumps(a,indent=2));print(json.dumps(dict(source=a['source'],base=base,images=a['images'])))
"""%(REMOTE,LIBSHA,source)
  value=json.loads(remote(code));write('production-preflight.json',value);print(json.dumps(dict(source=source,result='PASS')))
 elif action in ('prepare','activate'):
  print(run(SSH+['python3 '+REMOTE+'/release-operator.py '+action+' --apply-production-window']))
  value=json.loads(remote("from pathlib import Path\nprint(Path('"+REMOTE+"/status.json').read_text())"));write('production-'+action+'.json',value);print(json.dumps(value))
 elif action=='receipts':
  for name in ['artifact.json','migration-binding.json','status.json','backup-check.json','content.before.json','price-acceptance.json']:
   value=json.loads(remote("from pathlib import Path\nprint(Path('"+REMOTE+'/'+name+"').read_text())"));write(name,value)
  print('Scoped release receipts retrieved')
if __name__=='__main__':main()
