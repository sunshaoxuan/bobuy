"""Measure native screenshot ink inside known control backgrounds; no DOM text-box substitution."""
from pathlib import Path
from PIL import Image
import json,math,re,statistics
ROOT=Path(__file__).parent
TOP_LABELS={'我的资料','我的订单','商家维护','Your details','My orders','Merchant workspace','本人情報','注文履歴','出店者管理'}
def ink(image,box,light):
    x0,y0,x1,y1=box
    points=[]
    # Include antialiased visible glyph edges, rather than only the darkest glyph cores.
    pixels=[image.getpixel((x,y))[:3] for y in range(max(0,y0),min(image.height,y1)) for x in range(max(0,x0),min(image.width,x1))]
    if not pixels:return None
    background=tuple(statistics.median(p[c] for p in pixels) for c in range(3))
    for y in range(max(0,y0),min(image.height,y1)):
        for x in range(max(0,x0),min(image.width,x1)):
            r,g,b=image.getpixel((x,y))[:3]
            if sum(abs(p-v) for p,v in zip((r,g,b),background))>=30:points.append((x,y))
    if not points:return None
    return [min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points)+1,max(p[1] for p in points)+1]
results=[];failures=[]
files=list(ROOT.glob('accepted-*.json'))
assert files,'No final native control cases'
for file in files:
    data=json.loads(file.read_text(encoding='utf-8'));png=file.with_suffix('.png')
    image=Image.open(png).convert('RGB')
    assert image.size==(data['width'],data['height']),(file.name,image.size)
    assert not data['overflow'],file.name
    for n,control in enumerate(data['controls']):
        r=control['rect'];x,y,w,h=[r[k] for k in ['x','y','width','height']]
        assert h>=44-0.01,(file.name,control['label'],h)
        fg=list(map(int,re.findall(r'\d+',control['color'])[:3]));light=min(fg)>210
        bbox=ink(image,(math.ceil(x+6),math.ceil(y+6),math.floor(x+w-6),math.floor(y+h-6)),light)
        if not bbox:
            if control['tag']!='INPUT':failures.append([file.name,control['label'],'missing expected glyphs'])
            continue # Truly empty inputs have no ink to center.
        # Two-slot mobile shortcut: the text slot is below the separate 20px icon slot.
        if control['tag']=='A' and control['label'] in TOP_LABELS and data['width']<768:
            slot=control['labelRect'];sy=slot['y'];sh=slot['height']
            bbox=ink(image,(math.ceil(x+6),math.floor(sy),math.floor(x+w-6),math.ceil(sy+sh)),light)
            target_y=y+h/2+12 # Center of the fixed 39px text slot after the 20px icon row and 4px gap.
        else:target_y=y+h/2
        if not bbox:failures.append([file.name,control['label'],'missing expected glyphs']);continue
        gx=(bbox[0]+bbox[2])/2;gy=(bbox[1]+bbox[3])/2;gh=bbox[3]-bbox[1]
        tolerance=min(2,gh*.1)
        dy=abs(gy-target_y);dx=abs(gx-(x+w/2))
        margins=[bbox[0]-x-1,bbox[1]-y-1,x+w-1-bbox[2],y+h-1-bbox[3]]
        # Inputs are deliberately left-aligned; other complete text/icon groups are centered.
        centered=dy<=tolerance+.001 and (control['tag']=='INPUT' or dx<=tolerance+.001)
        record={'image':png.name,'label':control['label'],'tag':control['tag'],'ink':bbox,'dy':round(dy,3),'dx':round(dx,3),'tolerance':round(tolerance,3),'margins':list(map(lambda v:round(v,3),margins)),'height':h,'centered':centered}
        results.append(record)
        if not centered or min(margins)<3:failures.append(record)
out={'controls':len(results),'measurements':results,'failures':failures,'result':'PASS' if not failures else 'FAIL'}
(ROOT/'control-pixels.json').write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'controls':len(results),'failures':failures},ensure_ascii=True))
