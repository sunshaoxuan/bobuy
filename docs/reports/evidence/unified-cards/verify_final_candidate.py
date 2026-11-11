"""Bind final source/artifacts to real test and browser measurements.

Visual acceptance is recorded separately by the main agent after image review.
"""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[4]
evidence = Path(__file__).parent
out = evidence / 'user-reviews-b2-final'
load = lambda p: json.loads(p.read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

backend = load(evidence / 'backend-review-inputs.json')
assert all(sha(root / p) == digest for p, digest in backend.items())
frontend = load(evidence / 'frontend-c1-inputs.json')
changed = [p for p, digest in frontend.items() if sha(root / p) != digest]
css = 'frontend/src/components/productReviews.css'
assert changed == [css], changed
css_delta = ('html:has(.product-review-dialog),body:has(.product-review-dialog){overflow:hidden}\n'
             '.product-review-dialog .ant-modal-body{max-height:min(75dvh,calc(100dvh - 220px))}\n'
             '.review-comments>.ant-btn{width:100%}\n')
current = (root / css).read_bytes()
delta = css_delta.encode()
assert delta in current
assert hashlib.sha256(current.replace(delta, b'')).hexdigest() == frontend[css]

suite = load(evidence / 'frontend-c1-suite.json')
assert suite['numTotalTests'] == 750 and suite['numFailedTests'] == 0
cases = {}
for report in [suite]:
    for file in report['testResults']:
        for case in file['assertionResults']:
            cases[(file['name'], case['fullName'])] = case['status']
assert len(cases) == 750 and set(cases.values()) == {'passed'}

snapshots = load(out / 'page-geometry.json')
row_count = price_count = 0
for snapshot in snapshots:
    assert not snapshot['overflow'], snapshot['name']
    for grid in snapshot['grids']:
        assert grid['rowRule'] == 'auto'
        rows = []
        for card in grid['cards']:
            match = next((row for row in rows if abs(row[0]['top'] - card['top']) < 1), None)
            if match is None:
                rows.append([card])
            else:
                match.append(card)
            assert all(title['clamp'] == '2' for title in card['titles'])
            for price in card['prices']:
                assert price['lines'] == 1 and price['whiteSpace'] == 'nowrap'
                assert price['scroll'] <= price['client'] + 1
                price_count += 1
            for rating in card['ratings']:
                if rating['text'] == '暂无评分':
                    assert rating['empty'] == 5
            assert all(target['h'] >= 44 for target in card['actions'])
        for row in rows:
            assert max(c['bottom'] for c in row) - min(c['bottom'] for c in row) <= 1
            row_count += 1
        rows.sort(key=lambda row: row[0]['top'])
        for previous, following in zip(rows, rows[1:]):
            assert following[0]['top'] - max(c['bottom'] for c in previous) >= 6
catalog = next(s for s in snapshots if s['name'] == 'catalog-mobile')
cards = catalog['grids'][0]['cards']
assert abs(cards[2]['h'] - cards[3]['h']) <= 1
assert cards[4]['h'] < cards[2]['h'] - 20  # ordinary later row stays compact
long_price = next(p for c in cards for p in c['prices'] if p['text'] == '999,999,999,999')
assert float(long_price['font'].removesuffix('px')) < 24
assert any(p['text'] == '980' and p['font'] == '24px' for c in cards for p in c['prices'])

assert load(out / 'record-glyph-metrics.json')['result'] == 'PASS'
assert load(out / 'native-glyph-metrics.json')['result'] == 'PASS'
assert load(out / 'native-record-glyph-metrics.json')['result'] == 'PASS'
assert load(out / 'pagination-glyph-metrics.json')['result'] == 'PASS'
assert load(evidence / 'review-pagination-api.json')['result'] == 'PASS'
assert load(evidence / 'user-reviews-final/glyph-metrics.json')['result'] == 'PASS'
assert load(evidence / 'user-review-api.json')['result'] == 'PASS'
assert load(evidence / 'user-review-migration.json')['result'] == 'PASS'
network = load(out / 'browser-network.json')
assert all(r['type'] == 'response' and r['status'] < 400 for r in network)
assert load(out / 'browser-console.json') == []
assert load(evidence / 'frontend-c1-build.json')['result'] == 'PASS'
assert 'built in' in (evidence / 'frontend-c2-build.log').read_text(encoding='utf-8')
assert all(r['type'] == 'response' and r['status'] < 400 for r in load(out / 'c1-browser-network.json'))
assert load(out / 'c1-browser-console.json') == []
assert all(r['type'] == 'response' and r['status'] < 400 for r in load(out / 'c2-browser-network.json'))
assert load(out / 'c2-browser-console.json') == []

manifest = {p: sha(root / p) for p in frontend}
assets = {p.relative_to(root).as_posix(): sha(p) for p in sorted((root / 'frontend/dist').rglob('*')) if p.is_file()}
jar = root / 'bobbuy-core/target/bobbuy-core-0.1.0.jar'
assets[jar.relative_to(root).as_posix()] = sha(jar)
loaded = load(out / 'loaded-assets.json')
loaded_binding = {}
for url in loaded['scripts'] + loaded['styles']:
    path = root / 'frontend/dist' / urlparse(url).path.lstrip('/')
    assert path.is_file(), url
    loaded_binding[url] = sha(path)
(out / 'loaded-asset-binding.json').write_text(json.dumps(loaded_binding, indent=2) + '\n', encoding='utf-8')
(out / 'source-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
(out / 'artifact-manifest.json').write_text(json.dumps(assets, indent=2) + '\n', encoding='utf-8')
result = dict(mechanical_result='PASS', frontend_assertions=750, frontend_retested=0,
              frontend_failures=0, timeout_policy='unchanged 5000ms',
              post_test_change='three scoped review CSS rules; reverse-byte verified; built and browser revalidated',
              backend_inputs=len(backend), snapshots=len(snapshots), rows=row_count,
              prices=price_count, network_responses=len(network), console_errors=0,
              long_price_font=long_price['font'], later_row_reduction=cards[2]['h']-cards[4]['h'],
              visual_result='see main-agent final acceptance report')
(out / 'mechanical-result.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
