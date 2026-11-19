import urllib.request,time,json,statistics,re,concurrent.futures
from pathlib import Path
out=Path(__file__).resolve().parent
paths={'overview':'/api/storefront/product-browse/overview?merchantId=1000&locale=zh-CN','hints':'/api/storefront/category-icons','icon1':'/api/storefront/recommendation-images/icon-priority-fixture-01','icon2':'/api/storefront/recommendation-images/icon-priority-fixture-02'}
arms={'overview':['overview'],'hints':['overview','hints'],'one':['overview','hints','icon1'],'two':['overview','hints','icon1','icon2']}
def call(key,trace):
 t=time.perf_counter();r=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:18080'+paths[key],headers={'X-Trace-Id':trace}));h=time.perf_counter();body=r.read();end=time.perf_counter()
 return {'key':key,'trace':trace,'ttfbMs':(h-t)*1000,'totalMs':(end-t)*1000,'bytes':len(body),'status':r.status}
for key in paths:call(key,'causal-warm-'+key)
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for round in range(12):
  names=list(arms);names=names[round%4:]+names[:round%4]
  for arm in names:
   futures=[pool.submit(call,k,f'causal-s-{round}-{arm}-{k}') for k in arms[arm]]
   results=[f.result() for f in futures];rows.append({'round':round+1,'arm':arm,'requests':results})
logs=Path('/workspace/icon-runtime-final.log').read_text();costs={trace:int(ms) for ms,trace in re.findall(r'cost=(\d+)ms trace_id=(causal-s-\S+)',logs)}
for row in rows:
 for r in row['requests']:r['serverMs']=costs.get(r['trace'])
summary={arm:{k:statistics.median(next(r for r in row['requests'] if r['key']=='overview')[k] for row in rows if row['arm']==arm) for k in ['ttfbMs','totalMs','serverMs']} for arm in arms}
(out/'server-causal.json').write_text(json.dumps({'condition':'same loopback Spring and 465 active/14 synthetic deleted products; 12 rotated rounds; no throttling; 67KiB PNG icons','summary':summary,'rows':rows},indent=2)+'\n');print(json.dumps(summary,indent=2))
