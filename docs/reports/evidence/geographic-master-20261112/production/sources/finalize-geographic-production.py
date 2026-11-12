"""Final readback/binding and truthful reconciliation of the recovered release."""
import hashlib,importlib.util,json,math,re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('client',Path(__file__).with_name('geographic-release-client.py'));client=importlib.util.module_from_spec(spec);spec.loader.exec_module(client)
E=client.E
core=json.loads((E/'artifact.json').read_text(encoding='utf-8'));front=json.loads((E/'nav-release/artifact.json').read_text(encoding='utf-8'))
code='''from pathlib import Path
import fcntl,hashlib,importlib.util,json,shutil,sys
sys.dont_write_bytecode=True
root=Path('/opt/bobuy');stage=root/'releases/20261112.geographic_master.1'
spec=importlib.util.spec_from_file_location('lib',root/'releases/20261111.1/release_operator.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with (root/'releases/engagement-global.lock').open('a+') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 recovery=json.loads((stage/'recovery-status.json').read_text());assert recovery['phase']=='WRITES_OPEN_AFTER_FORWARD_RECOVERY'
 states={name:m.state(name) for name in (*m.WRITERS,'frontend',*m.PROTECTED)}
 assert states['core-service']['image']==CORE_IMAGE and states['core-service']['revision']==CORE_SOURCE
 assert states['frontend']['image']==FRONT_IMAGE and states['frontend']['revision']==FRONT_SOURCE
 assert all(v['health'] in ('running','healthy') for v in states.values())
 assert json.loads(m.run('python3',str(root/'scripts/protected-node-state.py')))==json.loads((stage/'protected-before.json').read_text())
 assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='34'
 counts=json.loads(m.sql("select json_object_agg(level,total) from (select level,count(*) total from bb_geographic_area group by level) t"));assert counts=={'1':249,'2':47,'3':1912}
 old=json.loads((stage/'status.json').read_text())
 if old['phase']=='FORWARD_RECOVERY_REQUIRED':
  assert not (stage/'status.initial-failure.json').exists();shutil.copy2(stage/'status.json',stage/'status.initial-failure.json')
  final=dict(phase='WRITES_OPEN',source=CORE_SOURCE,release=recovery['release'],at=recovery['at'],initialActivationPassed=False,recoveredForward=True,databaseRestoreForbidden=True,recoveryReceipt='recovery-status.json',frontendFollowup=FRONT_SOURCE)
  temp=stage/'status.reconciled.tmp';temp.write_text(json.dumps(final,indent=2));temp.replace(stage/'status.json')
 else:assert old['phase']=='WRITES_OPEN' and old['recoveredForward'] is True
 print(json.dumps(dict(result='PASS',states=states,databaseVersion=34,referenceCounts=counts,protectedUnchanged=True,originalFailureRetained=True,databaseRestorePerformed=False)))
'''
code=code.replace('CORE_IMAGE',repr(core['images'][0]['imageId'])).replace('CORE_SOURCE',repr(core['source'])).replace('FRONT_IMAGE',repr(front['images'][0]['imageId'])).replace('FRONT_SOURCE',repr(front['source']))
runtime=json.loads(client.remote(code));(E/'runtime-final.json').write_text(json.dumps(runtime,indent=2)+'\n',encoding='utf-8')
html=requests.get('https://bobuy.cc/admin/basic-data/geographic-areas',timeout=30);html.raise_for_status()
names=set(re.findall(r'(?:src|href)="/(assets/[^"]+)"',html.text))
names.update(n for n in front['frontend'] if n.startswith('assets/GeographicAreas-'))
assert names and any(n.endswith('.css') for n in names)
def asset(name):
    assert name in front['frontend'];response=requests.get('https://bobuy.cc/'+name,timeout=30);response.raise_for_status();actual=hashlib.sha256(response.content).hexdigest();assert actual==front['frontend'][name]
    return {'path':name,'sha256':actual,'status':response.status_code}
with ThreadPoolExecutor(max_workers=4) as pool:assets=list(pool.map(asset,sorted(names)))
(E/'loaded-assets.json').write_text(json.dumps(assets,indent=2)+'\n',encoding='utf-8')
browser=json.loads((E/'browser/browser.json').read_text(encoding='utf-8'));pixels=json.loads((E/'browser/pixels.json').read_text(encoding='utf-8'));nav=json.loads((E/'nav-final/acceptance.json').read_text(encoding='utf-8'))
assert browser['result']==pixels['result']==nav['result']=='PASS' and nav['candidateCssInjected'] is False
nav_pixels=[]
for state in nav['states']:
    image=Image.open(E/('nav-final/sidebar-'+str(state['viewport']['height'])+'.png')).convert('RGB');r=state['selected'];x,y,w,h=r['x'],r['y'],r['width'],r['height'];background=image.getpixel((math.floor(x+w/2),math.ceil(y+3)))
    # The icon occupies the first40px; the last32px are the pill cap/padding.
    ink=[(px,py) for py in range(math.ceil(y+1),math.floor(y+h-1)) for px in range(math.ceil(x+40),math.floor(x+w-32)) if max(abs(a-b) for a,b in zip(image.getpixel((px,py)),background))>=24]
    assert ink;bounds=[min(p[0] for p in ink),min(p[1] for p in ink),max(p[0] for p in ink)+1,max(p[1] for p in ink)+1];error=abs((bounds[1]+bounds[3])/2-(y+h/2));budget=min(2,(bounds[3]-bounds[1])*.1)
    margins=[bounds[0]-(x+1),bounds[1]-(y+1),x+w-1-bounds[2],y+h-1-bounds[3]];assert min(margins)>=3 and error<=budget
    nav_pixels.append({'viewport':state['viewport'],'actualGlyphBounds':bounds,'backgroundUsableInner':[x+1,y+1,x+w-1,y+h-1],'hotArea':r,'margins':margins,'verticalCenterError':error,'allowedError':budget,'alignment':'left-aligned menu label with icon; vertical center constrained'})
result={'result':'PASS','coreSource':core['source'],'frontendSource':front['source'],'schemaVersion':34,'referenceCounts':runtime['referenceCounts'],'existing45TablesUnchangedAtFrozenRecovery':True,'databaseRestorePerformed':False,'initialPublishFailedAndPreserved':True,'recoveredForward':True,'finalFrontendOnly':True,'productionBrowser':{'states':12,'consoleErrors':len(browser['consoleErrors']),'failedApplicationRequests':len(browser['failed']),'cloudflareRumReloadAborts':len(browser['telemetryAborted']),'temporaryFinalSessionLoggedOut':browser['temporarySessionLoggedOut']},'geometry':{'geographicControls':len(pixels['measurements']),'menuControls':nav_pixels},'loadedPublicAssets':assets,'mobileEvidenceReuse':'Only desktop-sidebar CSS changed in the final patch; prior actual360px geographic behavior and pixel evidence remain valid. Final desktop1000/800 uses the actual final frontend, without injected CSS.','policyCorrection':'Simple additive reference-data changes use idempotent import and focused readback; reuse confirmed offsite backup coverage instead of defaulting to an extra full snapshot. Offsite backup coverage was not independently established in this task.'}
(E/'final-acceptance.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'result':'PASS','core':core['source'][:7],'frontend':front['source'][:7],'schema':34,'referenceCounts':runtime['referenceCounts'],'assetsVerified':len(assets),'menuGlyphChecks':len(nav_pixels)}))
