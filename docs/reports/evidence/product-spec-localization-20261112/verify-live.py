from pathlib import Path
import importlib.util,json,urllib.parse
E=Path(__file__).resolve().parent;ROOT=E.parents[3]
spec=importlib.util.spec_from_file_location('prior',ROOT/'docs/reports/evidence/product-introductions-20261112/release-client.py');prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior)
code='''import importlib.util,json,subprocess
from pathlib import Path
s=importlib.util.spec_from_file_location('lib','/opt/bobuy/releases/20261111.1/release_operator.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
rollback=subprocess.check_output(['docker','image','inspect','--format','{{.Id}}','bobuy/frontend:20261112.gallery-upload-feedback'],text=True).strip()
print(json.dumps(dict(frontend=m.state('frontend'),core=m.state('core-service'),schema=m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1'),rollbackFrontendImageId=rollback,composeRecoveryExists=Path('/opt/bobuy/releases/20261112.product-fact-localization/compose.before.yml').is_file())))
'''
state=json.loads(prior.remote(code));before=json.loads((E/'production-before.json').read_text());staged=json.loads((E/'staged.json').read_text())
assert state['core']==before['core'] and state['schema']==before['schema']=='33'
assert state['rollbackFrontendImageId']==before['frontend']['image'] and state['composeRecoveryExists']
assert state['frontend']['image']==staged['imageId'] and state['frontend']['revision']==staged['source']
net=json.loads((E/'production-network.json').read_text());assert not net['truncated'] and not net['hasMore'] and not net['consoleErrors']
assert net['requests'] and all(not r.get('error') and r.get('status',0)<400 for r in net['requests'])
assets=json.loads((E/'frontend-files.json').read_text());observed={}
responses=json.loads((E/'production-response-hashes.json').read_text());assert not responses['truncated']
for row in responses['assets']:
 url=row['url'];assert url.startswith('https://bobuy.cc/assets/') and row['status']<400
 key=urllib.parse.urlparse(url).path.lstrip('/');assert key in assets,key
 assert row['sha256']==assets[key],key
 observed[key]=row['sha256']
assert observed
(E/'production-loaded-assets.json').write_text(json.dumps(observed,indent=2)+'\n',encoding='utf-8')
state.update(result='PASS',verifiedExternalAssets=len(observed),networkRequests=len(net['requests']),consoleErrors=0,failedNetworkRequests=0)
(E/'production-current.json').write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8');print(json.dumps(state))
