from pathlib import Path
import json,hashlib,re,subprocess,ast
from PIL import Image
E=Path(__file__).resolve().parent;ROOT=E.parents[3]
def read(n):return json.loads((E/n).read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
saved=read('saved-introductions.json');unresolved=read('unresolved-products.json');audit=read('master-final-audit.json');public=read('public-acceptance.json');source=read('source-traceability.json');validation=read('validation.json');crops=read('ui-original-pixel-crops.json');matrix=read('ui-production-native-matrix.json')
assert len(saved)==len({r['productId'] for r in saved})==297
assert len(unresolved)==13 and all(r['missingEvidence'] and r['unchanged'] and not r['public'] for r in unresolved)
assert len(audit['rows'])==389 and all(r['metadataPreserved'] for r in audit['rows'])
assert sum(r['introductionComplete'] for r in audit['rows'])==376
assert public['result']=='PASS' and public['publicCount']==public['fourLanguageIntroductions']==325 and public['newlyIntroduced']==266
public_ids={r['productId'] for r in public['rows']};assert all(r['productId'] not in public_ids for r in unresolved)
assert set(r['productId'] for r in source)==set(r['productId'] for r in saved)
assert all(r['sources'] and all(s['url'].startswith('https://') and re.fullmatch('[a-f0-9]{64}',s.get('sha256','')) for s in r['sources']) for r in source)
for r in saved:assert set(r['description'])=={'ja-JP','zh-CN','zh-TW','en-US'} and all(r['description'].values())
for name,digest in validation['files'].items():
 expected=validation['finalFrontend']['cssSha256'] if name==validation['finalFrontend']['changedInput'] else digest
 assert sha(ROOT/name)==expected,'Application input drift: '+name
assert read('ci.json')['conclusion']==read('currency-final/ci.json')['conclusion']=='success'
assert read('status.json')['phase']=='WRITES_OPEN' and read('status.json')['contentUnchanged']
assert read('currency-final/production-verify.json')['phase']=='VERIFIED'
assert read('migration-binding.json')['result']=='PASS' and len(read('migration-binding.json')['checks'])==34
assert read('cleanup.json')['result']=='PASS'
assert len(matrix['states'])==8 and len({(r['locale'],r['width']) for r in matrix['states']})==8 and all(not r['overflow'] for r in matrix['states'])
assert not matrix['applicationConsole'] and not matrix['network']['failed'] and not matrix['network']['truncated']
assert matrix['currencyFinal']['lines']==1
for row in crops:
 original=E/row['source'];assert sha(original)==row['sha256']
 with Image.open(original) as whole,Image.open(E/row['crop']) as crop:
  assert tuple(whole.size)==tuple(row['sourceSize']) and whole.crop(row['box']).convert('RGB').tobytes()==crop.convert('RGB').tobytes()
for name in ['README.md','../../PRODUCT-INTRODUCTIONS-20261112.md','../../../PRODUCT-CATALOG-MASTER.md']:
 path=(E/name).resolve();assert path.is_file()
 if path.name=='README.md':
  for target in re.findall(r'\]\(([^)]+)\)',path.read_text(encoding='utf-8')):assert (path.parent/target).resolve().exists(),target
for p in E.rglob('*.py'):
 if 'private' not in p.relative_to(E).parts:ast.parse(p.read_text(encoding='utf-8'))
assert subprocess.run(['git','diff','--quiet','3a8b11a','HEAD','--','backend','frontend','bobbuy-common','bobbuy-core','pom.xml','.github'],cwd=ROOT).returncode==0
value=dict(result='PASS',saved=297,complete=376,publicFourLanguage=325,unresolved=13,originalPixelCrops=len(crops),applicationInputsMatchAcceptedSources=True,documentationLinks=True,pythonSyntax=True)
(E/'evidence-validation.json').write_text(json.dumps(value,indent=2),encoding='utf-8');print(json.dumps(value))
