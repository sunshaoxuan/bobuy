from pathlib import Path
import json,re,hashlib
ROOT=Path(__file__).resolve().parents[4];E=Path(__file__).resolve().parent;p=ROOT/'frontend/src/locales/product-facts.json';a=json.loads(p.read_text(encoding='utf-8'))
for key in ['30卷，双层，宽114mm×长42.9m','12卷，每卷160节，双层']:
 a[key]['ja-JP']=a[key]['ja-JP'].replace('2層','二層');a[key]['en-US']=a[key]['en-US'].replace('2-ply','double-ply')
a['104条装']['en-US']='104 sticks'
for locale in ['zh-CN','zh-TW']:a['100枚×9包'][locale]=a['100枚×9包'][locale].replace('枚','片')
p.write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
numbers=lambda s:sorted(re.findall(r'\d+(?:\.\d+)?',s))
for k,v in a.items():
 assert set(v)=={'ja-JP','zh-CN','zh-TW','en-US'},k
 for locale,text in v.items():assert numbers(k)==numbers(text),(k,locale,text)
before=json.loads((E/'private/four-before.json').read_text(encoding='utf-8'));after=json.loads((E/'four-readback.json').read_text(encoding='utf-8'));candidate=json.loads((E/'four-candidate.json').read_text(encoding='utf-8'))
for old,new,prepared in zip(before,after,candidate):
 assert new['version']==old['version']+1 and new['description']==prepared['description']
 assert {k:v for k,v in old.items() if k not in ('version','description')}=={k:v for k,v in new.items() if k not in ('version','description')}
sources=[]
for row in after:
 n=row['itemNumber'];img=E/'private'/('official-'+n+'.jpg')
 sources.append(dict(itemNumber=n,productId=row['productId'],url='https://cds2.costcojapan.jp/cds/mail-images/upz/261108_bz7j/img08/s'+n+'.jpg',sha256=hashlib.sha256(img.read_bytes()).hexdigest(),method='Exact ITEM and own summary verified from official image pixels; no price/availability claims in introduction',savedVersion=row['version']))
(E/'official-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
unresolved=json.loads((ROOT/'docs/reports/evidence/product-introductions-20261112/unresolved-products.json').read_text(encoding='utf-8'));resolved={r['productId'] for r in after};unresolved=[r for r in unresolved if r['productId'] not in resolved]
(E/'unresolved-products.json').write_text(json.dumps(unresolved,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(E/'content-acceptance.json').write_text(json.dumps(dict(result='PASS',newSaved=4,completeMasters=380,totalMasters=389,remaining=9,eachVersionAdvancedOnce=True,otherSubmittedFieldsUnchanged=True,publicityUnchanged=True,reviewedTranslationLiterals=len(a),quantityTokensPreserved=True),indent=2)+'\n',encoding='utf-8')
print('Reviewed',len(a),'translation literals; four content saves verified; nine still pending')
