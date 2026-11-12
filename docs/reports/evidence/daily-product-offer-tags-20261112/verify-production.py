"""Read-only acceptance through actual public APIs and the installed timer."""
import importlib.util
import json
from pathlib import Path
import subprocess
import urllib.parse

E=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('offer_deploy',E/'deploy-task.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)
receipt=json.loads((E/'installed.json').read_text(encoding='utf-8'))
changes=receipt['first']['changes']
ids=[row['productId'] for row in changes]


def get(path):
    response=subprocess.run(['curl.exe','--fail','--silent','--show-error','--max-time','30','https://bobuy.cc'+path],capture_output=True,check=True)
    return json.loads(response.stdout)['data']


visible=[]
for start in range(0,len(ids),24):
    rows=get('/api/storefront/product-marker-assignments?'+urllib.parse.urlencode({'productIds':','.join(ids[start:start+24])}))
    for row in rows:
        discount=[m for m in row['markers'] if m['code']=='discount']
        assert len(discount)==1 and discount[0]['enabled'] and discount[0]['name']['zh-CN']=='优惠'
        visible.append(row['productId'])
assert set(visible)==set(ids) and len(visible)==159
marked=get('/api/storefront/product-browse?marked=true&locale=zh-CN')
assert marked['matchedTotal']==159 and len(marked['items'])>0
normal=get('/api/storefront/product-browse?locale=zh-CN')
assert normal['matchedTotal']>=marked['matchedTotal']
runtime=json.loads(deploy.remote('''import json,subprocess,hashlib
from pathlib import Path
def run(*args):return subprocess.check_output(args,text=True).strip()
def sql(q):
 p=subprocess.run(['docker','exec','-i','bobuy-postgres','sh','-c','exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'],input=q,text=True,capture_output=True,check=True)
 return p.stdout.strip()
print(json.dumps(dict(timer=run('systemctl','is-active','bobuy-offer-markers.timer'),enabled=run('systemctl','is-enabled','bobuy-offer-markers.timer'),
 service=run('systemctl','show','bobuy-offer-markers.service','-p','Result','-p','ExecMainStatus'),
 next=run('systemctl','show','bobuy-offer-markers.timer','-p','NextElapseUSecRealtime'),
 counts=json.loads(sql("select json_build_object('products',(select count(*) from bb_product where deleted_at is null),'markerSets',(select count(*) from bb_product_marker_set),'schema',(select version from flyway_schema_history where success order by installed_rank desc limit 1))")),
 health={n:json.loads(run('docker','inspect',n))[0]['State'].get('Health',{}).get('Status','running') for n in ['bobuy-core-service','bobuy-postgres','bobuy-frontend']})))
'''))
assert runtime['timer']=='active' and runtime['enabled']=='enabled'
assert runtime['counts']=={'products':389,'markerSets':159,'schema':'34'}
assert all(value in ('healthy','running') for value in runtime['health'].values())
report=dict(result='PASS',publicMarkerAssignmentsVerified=len(visible),markedBrowseTotal=marked['matchedTotal'],
 publicBrowseTotal=normal['matchedTotal'],runtime=runtime,source=receipt['source'],
 firstScheduledTrigger='2026-11-13 01:00:00 Asia/Tokyo; still future, not yet observed',
 uiCodeChanged=False,websiteRestarted=False)
(E/'production-acceptance.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
