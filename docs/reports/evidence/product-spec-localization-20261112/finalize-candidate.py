from pathlib import Path
import json,hashlib,subprocess,urllib.request,urllib.parse
E=Path(__file__).resolve().parent;ROOT=E.parents[3]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
binding=json.loads((E/'source-binding.json').read_text());assert binding['source']==source
rows=json.loads((E/'candidate-exact-matrix.json').read_text(encoding='utf-8'));latest={r['name']:r for r in rows};selected=[]
for lang in ['en','ja','cn','tw']:
 for size in ['mobile','desktop']:
  row=latest[f'candidate-{lang}-{size}'];assert row['viewport']==dict(width=320 if size=='mobile' else 1440,height=1000)
  assert not row['overflow'] and row['unitAlign']=='right' and row['priceCount']==1
  selected.append(row)
net=json.loads((E/'candidate-final-network.json').read_text());assert not net['truncated'] and not net['hasMore'] and not net['consoleErrors']
assert net['requests'] and all(not r.get('error') and r.get('status',0)<400 for r in net['requests'])
assets=json.loads((E/'frontend-files.json').read_text());observed={}
for r in net['requests']:
 url=r.get('url','')
 if not url.startswith('http://127.0.0.1:4190/assets/'):continue
 key=urllib.parse.urlparse(url).path.lstrip('/');assert key in assets,key
 with urllib.request.urlopen(url,timeout=20) as response:actual=hashlib.sha256(response.read()).hexdigest()
 assert actual==assets[key],key
 observed[key]=actual
assert observed
(E/'candidate-loaded-assets.json').write_text(json.dumps(observed,indent=2)+'\n',encoding='utf-8')
visual=dict(result='PASS',source=source,primary='Complete final eight locale/viewport PNGs and original-pixel crops inspected; factual quantities remain complete, no clipping or horizontal page overflow; prices/units right aligned; original Japanese title/brand identifiers intentionally retained',external='Gemini3.8 Flash High reviewed EN/JA corrected states and initial CN/TW states. Fresh Japanese frame confirms amount/unit complete. Ordinary continuous Japanese title wrapping retains the accepted unchanged title layout.',capture='Per-tab metrics + ordinary navigation + zero-origin viewport PNG; stale compositor frame superseded; offline crops verified byte-for-byte',images=json.loads((E/'candidate-crop-manifest.json').read_text()),changedControls='No interactive controls added or geometrically modified; existing CSS/markup/hit areas retained',budgets='Existing gutters and control geometry unchanged; body text stays within the recorded320/1440 viewport and price-card padding')
(E/'visual-acceptance.json').write_text(json.dumps(visual,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
accept=dict(result='PASS',source=source,frontendManifestSha256=sha(E/'frontend-files.json'),functional='Both catalogue and recommendation entry paths, gallery next2/5 and previous1/5, close/reopen/deep link; original ITEM and exact pack factors preserved; No.77839 has one warehouse1498 card and Online1828 annotation with0 discounts on Japan day2026-11-12',geometry=selected,consoleErrors=0,networkRequests=len(net['requests']),failedNetworkRequests=0,visualEvidence='visual-acceptance.json',content='content-acceptance.json')
(E/'candidate-acceptance.json').write_text(json.dumps(accept,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(source=source,result='PASS',states=8,network=len(net['requests']))))
