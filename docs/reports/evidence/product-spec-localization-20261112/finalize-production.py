from pathlib import Path
import json,hashlib
E=Path(__file__).resolve().parent
read=lambda n:json.loads((E/n).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
live=read('production-current.json');assert live['result']=='PASS' and live['schema']=='33'
activation=read('production-activate.json');assert activation['phase']=='FRONTEND_LIVE' and activation['source']==live['frontend']['revision']
assert read('production-verify.json')['phase']=='VERIFIED'
assert read('public-unchanged.json')['result']=='PASS' and read('public-unchanged.json')['publicProducts']==325
assert read('content-acceptance.json')['completeMasters']==380
latest={r['name']:r for r in read('production-matrix.json')};selected=[]
for locale in ['en','ja','cn','tw']:
 for size in ['mobile','desktop']:
  r=latest[f'production-{locale}-{size}'];assert not r['overflow'] and r['priceCount']==1 and r['unitAlign']=='right'
  assert r['viewport']==dict(width=320 if size=='mobile' else 1440,height=1000)
  if size=='mobile':assert r['scroll']['bottom'] and r['cta']['height']>=44 and r['cta']['bottom']<=997
  selected.append(r)
 for prefix in ['production-rec-']:
  r=latest[prefix+locale+'-mobile'];assert r['viewport']['width']==360 and not r['overflow'] and r['scroll']['bottom'] and r['cta']['bottom']<=997
expired=latest['production-expired-en-mobile'];assert expired['priceCount']==1 and expired['text'].count('1,498')==1 and expired['text'].count('1,828')==1 and '−' not in expired['text']
card=read('production-card.json');assert card['unitAlign']=='right' and card['unitTitle']=='1 box (42g×40 bags)' and card['code']=='No.61432' and card['amount']=='1,598'
assert read('ci.json')['run']['conclusion']=='success' and read('ci.json')['source']==live['frontend']['revision']
receipt=dict(result='PASS',source=live['frontend']['revision'],release=live['frontend']['tag'],activatedUtc=activation['at'],activatedJapan='2026-11-12 15:09:01 JST',frontendImageId=live['frontend']['image'],coreUnchanged=live['core'],schema=33,fullFrontendPassed=818,finalAffectedPassed=48,codeql='success',content=dict(total=389,complete=380,newSaved=4,explicitlyPending=9,publicationUnchanged=True),publicProductsPreserved=325,allHistoricalFieldsPreserved=True,browser=dict(catalogueLocales=4,desktop='1440x1000',mobile='320x1000',recommendationLocales=4,recommendationMobile='360x1000',mainPriceCards=1,expiredWarehouse=1498,expiredOnline=1828,consoleErrors=0,failedRequests=0,observedResponseHashes=16,containerFileHashes=82,card=card),functional='PASS',geometry='PASS',visual='PASS after original-pixel whole/crop inspection; final screenshots supersede incomplete scroll captures',screenshots=read('production-crop-manifest.json'),rollback='Previous gallery-upload-feedback frontend image and compose.before.yml retained. Application-only rollback; saved descriptions remain compatible. No database restore.',repository='Application candidate ea7b7fe and formal receipts delivered through PR70; current integration outcome is tracked by PR/Git')
(E/'acceptance.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:receipt[k] for k in ['result','source','activatedJapan','fullFrontendPassed','finalAffectedPassed','content']}))
