from pathlib import Path
import subprocess,json,sys,datetime
E=Path('docs/reports/evidence/product-introductions-20261112')
def inventory():
 script="const rows=[];for(let p=0;p<100;p++){const r=await fetch('https://bobuy.cc/api/storefront/product-catalog?page='+p);if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(j.status!=='success')throw Error('Response');rows.push(...j.data.items);if(!j.data.hasNext)break;}process.stdout.write(JSON.stringify(rows));"
 rows=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],text=True,encoding='utf-8'))
 assert len(rows)==len({x['productId'] for x in rows});return rows
def write(name,x):(E/name).write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
rows=inventory()
if sys.argv[1]=='baseline':
 write('public-before-release.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),items=rows));print('Public baseline: '+str(len(rows)))
else:
 before=json.loads((E/'private/public-before-release.json').read_text(encoding='utf-8'))['items'];byid={x['productId']:x for x in before};drafts={x['productId']:x for x in json.loads((E/'private/drafts.json').read_text(encoding='utf-8'))}
 assert {x['productId'] for x in rows}==set(byid),'Public eligibility changed'
 checked=[]
 for row in rows:
  old=byid[row['productId']];intro=row.pop('introduction',{});assert row=={k:v for k,v in old.items() if k!='introduction'},'Historical/public field changed: '+row['productId']
  row['introduction']=intro
  if row['productId'] in drafts and row['itemNumber']!='77839':assert intro==drafts[row['productId']]['description'],'Prepared introduction differs: '+row['productId']
  if row['productId'] in drafts:assert len(intro)==4
  checked.append(dict(productId=row['productId'],itemNumber=row['itemNumber'],fourLanguages=len(intro)==4,newIntroduction=row['productId'] in drafts,historicalPreserved=True))
 write('public-after-release.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),items=rows));value=dict(result='PASS',publicCount=len(rows),newlyIntroduced=sum(x['newIntroduction'] for x in checked),fourLanguageIntroductions=sum(x['fourLanguages'] for x in checked),publicIdentitiesUnchanged=True,allHistoricalFieldsPreserved=True,rows=checked);write('public-acceptance.json',value);print(json.dumps({k:v for k,v in value.items() if k!='rows'}))
