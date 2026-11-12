from pathlib import Path
import json,hashlib
from PIL import Image
e=Path(__file__).resolve().parent
root=e.parents[3]
read=lambda name:json.loads((e/name).read_text(encoding='utf-8-sig'))
b=read('binding.json');ci=read('ci.json')
assert ci['headSha']==b['source'] and ci['conclusion']=='success'
assert hashlib.sha256((root/'infra/nacos/config/gateway-service.yaml').read_bytes()).hexdigest()==b['configSha256']
assert hashlib.sha256((e/'config-operator.py').read_bytes()).hexdigest()==b['operatorSha256']
for p in e.glob('*.py'):compile(p.read_bytes(),str(p),'exec')
tests=read('gateway-tests.json');assert tests['tests']==6 and tests['failures']==tests['errors']==tests['skipped']==0
stats={}
for name in ['polling-requests.json','mobile-requests.json']:
    rows=read(name);assert rows and all(r['status']==200 for r in rows)
    assert any(r['url'].endswith('/status') for r in rows) and any(r['url'].endswith('/costco-onboarding') for r in rows)
    stats[name]={'responses':len(rows),'spanSeconds':max(r['timestamp'] for r in rows)-min(r['timestamp'] for r in rows)}
assert stats['polling-requests.json']['spanSeconds']>=30
for name,size in [('after-mobile-drawer.png',(390,844)),('after-mobile-header.jpg',(390,250)),('after-desktop-drawer.jpg',(2022,1017))]:
    with Image.open(e/name) as image:
        assert image.size==size,(name,image.size)
        assert image.format==('PNG' if name.endswith('.png') else 'JPEG')
logs=read('console.json');assert all(x['url'].startswith('chrome-extension://') for x in logs)
runtime=read('runtime-after.json')
assert all(x['status']==(401 if x.get('authenticated') is False else 200) for x in runtime if x['service']=='gateway-service')
assert read('runtime-reconciled.json')['phase']=='CONFIG_AND_RUNTIME_RECONCILED'
assert read('cleanup.json')['result']=='PASS'
result={'result':'PASS','source':b['source'],'network':stats,'images':'dimensions verified; actual visual review recorded separately','scripts':'syntax PASS'}
(e/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
