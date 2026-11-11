"""Original screenshot pixels, with the predeclared 3px/44px/10% budgets."""
import json, math
from pathlib import Path
from PIL import Image

root=Path(__file__).parent/'user-reviews-b2-final'
results=[]
for width in [390,360]:
    meta=json.loads((root/f'pagination-{width}-controls.json').read_text(encoding='utf-8'))
    im=Image.open(root/f'pagination-{width}-native.png').convert('RGB')
    assert im.size==(meta['viewport']['w'],meta['viewport']['h'])
    r=meta['rect']; label=meta['label']
    # Restrict glyph detection to the measured label interior, excluding the border.
    points=[(x,y) for x in range(math.ceil(label['left']),math.floor(label['right']))
            for y in range(math.ceil(label['top']),math.floor(label['bottom']))
            if max(im.getpixel((x,y)))<160]
    assert points
    xs,ys=zip(*points); ink=[min(xs),min(ys),max(xs)+1,max(ys)+1]
    margins=[ink[0]-r['left'],ink[1]-r['top'],r['right']-ink[2],r['bottom']-ink[3]]
    error=[abs((ink[0]+ink[2]-r['left']-r['right'])/2),abs((ink[1]+ink[3]-r['top']-r['bottom'])/2)]
    tolerance=min(2,(ink[3]-ink[1])*.1)
    passed=min(margins)>=3 and max(error)<=tolerance and r['height']>=44
    im.crop((math.floor(r['left'])-4,math.floor(r['top'])-4,math.ceil(r['right'])+4,math.ceil(r['bottom'])+4)).save(root/f'pagination-{width}-detail.png')
    results.append(dict(viewport=meta['viewport'],usable_frame=r,ink=ink,margins=margins,center_error=error,tolerance=tolerance,result='PASS' if passed else 'FAIL'))
result=dict(result='PASS' if all(r['result']=='PASS' for r in results) else 'FAIL',controls=results)
(root/'pagination-glyph-metrics.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
assert result['result']=='PASS'
