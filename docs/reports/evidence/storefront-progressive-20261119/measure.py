"""Natural loopback timing, same real application/database; no artificial delay."""
import urllib.request,urllib.parse,time,json,sys,statistics
from pathlib import Path
root=Path(__file__).parent
base='http://127.0.0.1:18080/api/storefront/product-browse'
def get(suffix):
 start=time.perf_counter()
 with urllib.request.urlopen(base+suffix,timeout=30) as r:
  data=r.read();x=json.loads(data)['data']
 return x,{'ms':round((time.perf_counter()-start)*1000,2),'bytes':len(data)}
mode=sys.argv[1];rounds=[]
for n in range(6):
 row={'round':n+1}
 for kind in (['legacy','progressive'] if n%2==0 else ['progressive','legacy']):
  if kind=='legacy':
   x,t=get('?locale=zh-CN&merchantId=1000');row['legacy']=t;row['products']=x['matchedTotal']
  else:
   x,t=get('/overview?locale=zh-CN&merchantId=1000');row['overview']=t
   if mode=='before':
    _,u=get('/shelf?'+urllib.parse.urlencode({'locale':'zh-CN','merchantId':1000,'category':x['shelves'][0]['category'],'revision':x['revision']}));row['firstShelf']=u;row['firstContentMs']=round(t['ms']+u['ms'],2)
   else:row['firstContentMs']=t['ms']
 rounds.append(row)
report={'application':mode,'transport':'loopback real HTTP, no injected delay; alternating order, all six samples retained','rounds':rounds,'legacyMedianMs':statistics.median(r['legacy']['ms'] for r in rounds),'firstContentMedianMs':statistics.median(r['firstContentMs'] for r in rounds)}
(root/('natural-'+mode+'.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
