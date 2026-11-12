"""Measure visible glyph pixels of real selector backgrounds and popup options."""
from pathlib import Path
from PIL import Image
import json,math,statistics
ROOT=Path(__file__).parent
results=[];failures=[]
for file in sorted(ROOT.glob('accepted-*.json')):
 data=json.loads(file.read_text(encoding='utf-8'));im=Image.open(file.with_suffix('.png')).convert('RGB')
 assert im.size==(data['width'],data['height']) and not data['overflow']
 popup=data['popup']
 if popup:assert popup['left']>=16 and popup['right']<=data['width']-16 and popup['top']>=68 and popup['bottom']<=data['height']-(69 if data['width']<768 else 0)
 for c in data['controls']:
  r=c['rect'];t=c['textRect'];assert r['height']>=44-.01
  x0=math.ceil(max(t['x'],r['x']+3));y0=math.ceil(max(t['y'],r['y']+3));x1=math.floor(min(t['right'],r['right']-3));y1=math.floor(min(t['bottom'],r['bottom']-3))
  pixels=[im.getpixel((x,y)) for y in range(y0,y1) for x in range(x0,x1)]
  assert pixels,(file.name,c['label'])
  bg=tuple(statistics.median(p[n] for p in pixels) for n in range(3))
  ink=[(x,y) for y in range(y0,y1) for x in range(x0,x1) if sum(abs(v-b) for v,b in zip(im.getpixel((x,y)),bg))>=30]
  if not ink:failures.append({'file':file.name,'label':c['label'],'reason':'no visible ink'});continue
  box=[min(p[0] for p in ink),min(p[1] for p in ink),max(p[0] for p in ink)+1,max(p[1] for p in ink)+1]
  dy=abs((box[1]+box[3])/2-(r['y']+r['height']/2));tolerance=min(2,(box[3]-box[1])*.1)
  margins=[box[0]-r['x']-1,box[1]-r['y']-1,r['right']-box[2]-1,r['bottom']-box[3]-1]
  row={'file':file.name,'role':c['tag'],'label':c['label'],'ink':box,'dy':round(dy,3),'tolerance':round(tolerance,3),'margins':margins,'height':r['height']}
  results.append(row)
  if dy>tolerance+.001 or min(margins)<3:failures.append(row)
out={'controls':len(results),'result':'FAIL' if failures else 'PASS','measurements':results,'failures':failures,'scope':'geometry and real glyph pixels only; visual review separate'}
(ROOT/'control-pixels.json').write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'controls':len(results),'failures':failures},ensure_ascii=True))
assert not failures
