"""Original-pixel record action crops and the same fixed glyph/target budgets."""
import json
import math
import sys
from pathlib import Path
from PIL import Image

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / 'user-reviews-final'
native = len(sys.argv) > 2 and sys.argv[2] == 'native'
metadata = json.loads((root / ('record-native-controls.json' if native else 'record-controls-raw.json')).read_text(encoding='utf-8'))
raw = Image.open(root / ('records-mobile-native.png' if native else 'record-controls-raw.jpg')).convert('RGB')
if native:
    assert raw.size == (metadata['viewport']['width'], metadata['viewport']['height'])
sx, sy = raw.width / metadata['viewport']['width'], raw.height / metadata['viewport']['height']
results = []
for index, rect in enumerate(metadata['controls']):
    left, top = math.floor(rect['x'] * sx) - 12, math.floor(rect['y'] * sy) - 12
    frame = (rect['x'] * sx - left, rect['y'] * sy - top,
             (rect['x'] + rect['w']) * sx - left, (rect['y'] + rect['h']) * sy - top)
    im = raw.crop((left, top, math.ceil((rect['x'] + rect['w']) * sx) + 12,
                   math.ceil((rect['y'] + rect['h']) * sy) + 12))
    image = f'{"native-" if native else ""}record-action-{index}.png'
    im.save(root / image)
    points = [(x, y) for y in range(math.ceil(frame[1] + 4 * sy), math.floor(frame[3] - 4 * sy))
              for x in range(math.ceil(frame[0] + 4 * sx), math.floor(frame[2] - 4 * sx))
              if min(im.getpixel((x, y))) < 160]
    assert points and len(points) < rect['w'] * rect['h'] * sx * sy * .4
    xs, ys = zip(*points)
    ink = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    margins = [(ink[0] - frame[0]) / sx, (ink[1] - frame[1]) / sy,
               (frame[2] - ink[2]) / sx, (frame[3] - ink[3]) / sy]
    dx = abs((ink[0] + ink[2] - frame[0] - frame[2]) / 2 / sx)
    dy = abs((ink[1] + ink[3] - frame[1] - frame[3]) / 2 / sy)
    tolerance = min(2, (ink[3] - ink[1]) / sy * .1)
    passed = min(margins) >= 3 and max(dx, dy) <= tolerance and rect['h'] >= 44
    results.append(dict(image=image, label=rect['text'], target=rect, usable_frame=frame,
                        ink=ink, glyph_margins=margins, center_error=[dx, dy], tolerance=tolerance,
                        result='PASS' if passed else 'FAIL'))
gap_x = metadata['controls'][1]['x'] - metadata['controls'][0]['x'] - metadata['controls'][0]['w']
gap_y = metadata['controls'][2]['y'] - metadata['controls'][0]['y'] - metadata['controls'][0]['h']
output = dict(controls=results, target_gaps=[gap_x, gap_y],
              result='PASS' if min(gap_x, gap_y) >= 6 and all(r['result'] == 'PASS' for r in results) else 'FAIL')
(root / ('native-record-glyph-metrics.json' if native else 'record-glyph-metrics.json')).write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(output, ensure_ascii=True, indent=2))
raise SystemExit(0 if output['result'] == 'PASS' else 1)
