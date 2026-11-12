"""Finalize exact mail-page evidence and activate the staged frontend after CI."""
from pathlib import Path
import json,subprocess,hashlib,sys
E=Path(__file__).resolve().parent;ROOT=E.parents[3];REMOTE='/opt/bobuy/releases/20261112.mail-settings.3'
SSH=['ssh','-i','C:/workspace/Secure/sunsxaws.pem','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','root@185.184.223.41']
SCP=['scp','-i','C:/workspace/Secure/sunsxaws.pem','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes']
def run(a):
 p=subprocess.run(a,capture_output=True,text=True,encoding='utf-8',errors='replace')
 if p.returncode:raise RuntimeError('Release command failed: '+p.stderr[-400:])
 return p.stdout.strip()
def read(n):return json.loads((E/n).read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
a=read('staged-artifact.json');assert a['source']==run(['git','rev-parse','HEAD'])
ci=json.loads(run(['gh','run','view','43140249364','--json','status,conclusion,headSha,url']))
assert ci['headSha']==a['source'] and ci['status']=='completed' and ci['conclusion']=='success','Exact-source CI is not yet successful'
tests=read('tests.json');assert tests['success'] and tests['numPassedTests']==10 and tests['numFailedTests']==0
pixels=read('glyph-pixels.json');assert pixels['result']=='PASS' and len(pixels['controls'])==144
ready=read('ready-local-glyph-pixels.json');assert ready['result']=='PASS' and len(ready['controls'])==36
matrix=read('final-matrix.json')['matrix'];assert len(matrix)==12 and all(not r['overflow'] and all(c['insidePanel'] for c in r['controls']) for r in matrix)
browser=read('browser-functional.json');assert not browser['applicationErrors'] and all(r['status']==200 for r in browser['apiResponses'])
assert read('inbox.json')['result']=='PASS'
for name,digest in a['frontend'].items():assert sha(ROOT/'frontend/dist'/name)==digest
source_files=['frontend/src/pages/MailSettings.tsx','frontend/src/pages/MailSettings.css','frontend/src/pages/MailSettings.test.tsx','frontend/package-lock.json','frontend/nginx.conf']+['frontend/src/locales/'+locale+'.ts' for locale in ['en-US','ja-JP','zh-CN','zh-TW']]
g={'source':a['source'],'result':'PASS','ci':ci,'tests':10,'i18nKeys':1665,'build':'PASS','functional':'PASS','screenshots':12,'actualInkControls':144,'readyStateInkControls':36,'reuseBoundary':'Only selected recipient CSS changed; prior placeholders and behavior unchanged','visual':'PASS','selfInbox':'PASS','sourceFiles':{n:sha(ROOT/n) for n in source_files}}
(E/'gates.json').write_text(json.dumps(g,indent=2),encoding='utf-8');a['gatesSha256']=sha(E/'gates.json');assert a['operatorSha256']==sha(E/'frontend-release-operator.py');(E/'artifact.json').write_text(json.dumps(a,indent=2),encoding='utf-8')
run(SCP+[str(E/'gates.json'),str(E/'artifact.json'),'root@185.184.223.41:'+REMOTE+'/'])
for phase in ['prepare','activate']:
 output=run(SSH+['flock -n /opt/bobuy/releases/engagement-global.lock python3 '+REMOTE+'/frontend-release-operator.py '+phase+' --apply-production-window'])
 status=json.loads(run(SSH+['cat '+REMOTE+'/status.json']));(E/('production-'+phase+'.json')).write_text(json.dumps(status,indent=2));print(json.dumps(status))
