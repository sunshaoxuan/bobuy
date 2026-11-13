from pathlib import Path
import urllib.request,json
root=Path(__file__).parent/'docs/reports/evidence/offer-period-presentation-20261113';rows=json.loads((root/'local/browser.json').read_text(encoding='utf-8'))['views'];results=[]
for v in rows:
 if v.get('synthetic'):continue
 for failure in v['network']:
  assert failure.get('failure')=='net::ERR_ADDRESS_IN_USE' and '/recommendation-images/' in failure['url']
  with urllib.request.urlopen(failure['url'],timeout=30) as r:body=r.read();assert r.status==200 and body;results.append(dict(url=failure['url'],status=r.status,bytes=len(body),contentType=r.headers.get('Content-Type'),scope='single previously failed image URL only'))
(root/'local/image-retry.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8');print(json.dumps(results))
