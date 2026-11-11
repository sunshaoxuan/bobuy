"""Measure actual screenshot ink against predeclared control budgets.

Inputs are original browser crops with 12px context. This is screenshot analysis,
not image editing. Background borders and resize decorations are excluded.
"""
import json
import math
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / 'user-reviews-final'
native = len(sys.argv) > 2 and sys.argv[2] == 'native'
ROLES = [('close', 180, True, True), ('score', 180, False, True),
         ('comment', 140, False, False), ('save', 210, True, True)]
results = []
for label in ['mobile', 'desktop']:
  raw = Image.open(ROOT / (f'review-{label}-native.png' if native else f'review-raw-{label}.jpg')).convert('RGB')
  metadata = json.loads((ROOT / (f'review-native-{label}.json' if native else f'review-raw-{label}.json')).read_text())
  if native:
    assert raw.size == (metadata['viewport']['width'], metadata['viewport']['height'])
  sx, sy = raw.width / metadata['viewport']['width'], raw.height / metadata['viewport']['height']
  for index, (role, threshold, center_x, center_y) in enumerate(ROLES):
    rect = metadata['controls'][index]
    left, top = math.floor(rect['x'] * sx) - 12, math.floor(rect['y'] * sy) - 12
    right = math.ceil((rect['x'] + rect['w']) * sx) + 12
    bottom = math.ceil((rect['y'] + rect['h']) * sy) + 12
    im = raw.crop((left, top, right, bottom))
    path = ROOT / f'{"native-" if native else ""}ink-{label}-{index}.png'
    im.save(path)  # Lossless original-pixel crop, no resampling or alteration.
    frame = (rect['x'] * sx - left, rect['y'] * sy - top,
             (rect['x'] + rect['w']) * sx - left, (rect['y'] + rect['h']) * sy - top)
    inner = (frame[0] + sx, frame[1] + sy, frame[2] - sx, frame[3] - sy)
    assert min(im.getpixel((round(frame[0] + 6), round(frame[1] + 6)))) >= 225, f'Wrong control crop: {label}/{role}'
    # Exclude borders/corners/resize decoration; score text excludes desktop steppers.
    x_end = frame[0] + (65 if role == 'score' else rect['w'] - 8) * sx
    pixels = [(x, y) for y in range(math.ceil(frame[1] + 8 * sy), math.floor(frame[3] - 8 * sy))
              for x in range(math.ceil(frame[0] + 8 * sx), math.floor(x_end))
              if max(im.getpixel((x, y))) < threshold]
    if not pixels:
        raise AssertionError(f'No text/icon ink found: {role}')
    xs, ys = zip(*pixels)
    ink = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    assert len(pixels) < rect['w'] * rect['h'] * sx * sy * .4, f'Background mistaken for glyphs: {label}/{role}'
    margins = [(ink[0] - inner[0]) / sx, (ink[1] - inner[1]) / sy,
               (inner[2] - ink[2]) / sx, (inner[3] - ink[3]) / sy]
    error_x = abs((ink[0] + ink[2] - inner[0] - inner[2]) / 2 / sx)
    error_y = abs((ink[1] + ink[3] - inner[1] - inner[3]) / 2 / sy)
    tolerance = min(2, (ink[3] - ink[1]) / sy * .1)
    passed = min(margins) >= 3 and (not center_x or error_x <= tolerance) and (not center_y or error_y <= tolerance)
    results.append(dict(view=label, role=role, image=path.name, frame=frame, usable=inner,
                        ink=ink, glyph_margins=margins,
                        center_error_x=error_x if center_x else None,
                        center_error_y=error_y if center_y else None,
                        tolerance=tolerance, geometry='PASS' if passed else 'FAIL'))
output = dict(method='original browser JPEG glyph/icon pixels; fixed budgets; screenshot-to-viewport scale recorded', controls=results,
              result='PASS' if all(r['geometry'] == 'PASS' for r in results) else 'FAIL')
(ROOT / ('native-glyph-metrics.json' if native else 'glyph-metrics.json')).write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8')
print(json.dumps(output, indent=2))
raise SystemExit(0 if output['result'] == 'PASS' else 1)
