"""Measure visible warm-colour heat glyphs in final browser screenshots."""
import json
import math
from pathlib import Path
from PIL import Image

base = Path(__file__).parent
report = json.loads((base / 'browser.json').read_text(encoding='utf-8'))
results = []
for view in report['views']:
    image = Image.open(base / view['screenshot'].replace('.png','-card.png')).convert('RGB')
    box = dict(view['geometry'][0]['heat'])
    card = view['geometry'][0]['card']
    for key in ['x', 'right']:
        box[key] -= math.floor(card['x'])
    for key in ['y', 'bottom']:
        box[key] -= math.floor(card['y'])
    points = []
    for y in range(round(box['y']), round(box['bottom'])):
        for x in range(round(box['x']), round(box['right'])):
            r, g, b = image.getpixel((x, y))
            if 70 < r < 230 and r > g * 1.2 and g > b * 1.2:
                points.append((x, y))
    assert points
    left, top = map(min, zip(*points))
    right, bottom = (max(p[0] for p in points) + 1, max(p[1] for p in points) + 1)
    margins = [left-box['x'], top-box['y'], box['right']-right, box['bottom']-bottom]
    center_error = abs((top+bottom)/2 - (box['y']+box['bottom'])/2)
    results.append({'route': view['route'], 'width': view['width'], 'glyph': [left,top,right,bottom], 'availableFrame': box, 'margins': margins, 'verticalCenterError': center_error})
    assert min(margins) >= 3, results[-1]
    assert center_error <= min(2, (bottom-top)*.1), results[-1]
(base / 'pixels.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(f'{len(results)} visible heat glyph measurements passed')
