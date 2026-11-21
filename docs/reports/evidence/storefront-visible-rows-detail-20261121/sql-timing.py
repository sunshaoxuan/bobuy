import urllib.request,time,datetime,subprocess,re,json,sys,pathlib
label=sys.argv[1];out=[]
for run in range(3):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();begin=time.perf_counter()
 with urllib.request.urlopen('http://127.0.0.1:18080/api/storefront/product-browse/progressive-item-1-1?merchantId=1000') as r: payload=r.read()
 elapsed=(time.perf_counter()-begin)*1000
 log=subprocess.run(['docker','logs','--since',start,'bobuy-manual-create-test'],capture_output=True,text=True)
 lines=(log.stdout+log.stderr).splitlines();statements=[]
 for line in lines:
  match=re.search(r'duration: ([\d.]+) ms\s+(.*)',line)
  if match:
   sql=match[2];statements.append({'ms':float(match[1]),'phase':sql.split(':')[0],'tables':sorted(set(re.findall(r'(?:from|join) (bb_\w+)',sql))), 'productIn':bool(re.search(r'from bb_product .*where .*id in',sql))})
 out.append({'run':run+1,'apiMs':elapsed,'bodyBytes':len(payload),'statementCount':len(statements),'sqlMs':sum(s['ms'] for s in statements),'statements':statements})
pathlib.Path(__file__).with_name(label+'-sql.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps([{k:v for k,v in r.items() if k!='statements'} for r in out],indent=2))
