"""Verify retained production evidence hashes, references and cleanup state."""
from pathlib import Path
import hashlib,json,re
root=Path(__file__).resolve().parents[1]
out=root/'docs/reports/evidence/product-engagement-production'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=read(out/'final-acceptance-v2.json');assert receipt['result']=='PASS'
assert all((out/name).is_file() and sha(out/name)==value for name,value in receipt['evidence'].items())
binding=read(out/'final-production-binding-v2.json')
assert all((out/name).is_file() and sha(out/name)==value for name,value in binding['screenshots'].items())
assert set(binding['retiredProcessScreenshotHashes'])=={'page-diagnostic.png'}
assert read(out/'release-cleanup.json')['status']=='PASS' and read(out/'drive-map-cleanup.json')['result']=='PASS'
assert all(not (root/name).exists() for name in ['.release-work','frontend/node_modules','frontend/dist','backend/target','bobbuy-common/target','bobbuy-core/target'])
for name in ['docs/plans/PRODUCT-SORT-POPULARITY-20261111.md','docs/reports/PRODUCT-ENGAGEMENT-PRODUCTION-20261112.md','docs/reports/PRODUCT-ENGAGEMENT-20261112.md']:
 p=root/name
 for link in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf-8')):
  if not link.startswith(('https://','http://','/')):assert (p.parent/link.split('#')[0]).exists(),(name,link)
print('FINAL_RETAINED_EVIDENCE_HASHES_REFERENCES_AND_CLEANUP_PASS')
