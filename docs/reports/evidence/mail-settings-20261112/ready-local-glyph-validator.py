"""Measure actual rendered ink against fixed control budgets from final screenshots."""
from pathlib import Path
from PIL import Image
import json,math
E=Path(__file__).parent
matrix=json.loads((E/'ready-local-matrix.json').read_text(encoding='utf-8'))['matrix'];results=[]
for scene in matrix:
 im=Image.open(E/scene['screenshot']).convert('RGB')
 for i,c in enumerate(scene['controls']):
  if c['type']=='switch':continue
  x=round(c['x']);y=round(c['y']);w=round(c['w']);h=round(c['h'])
  crop=im.crop((x,y,x+w,y+h));center=crop.getpixel((w//2,3));dark=max(center)<100;pts=[]
  for b in range(3,h-3):
   for a in range(3,w-3):
    pixel=crop.getpixel((a,b));ink=min(pixel)>160 if dark else max(pixel)<(230 if c['disabled'] else 200)
    if ink:pts.append((a,b))
  assert pts,(scene['locale'],scene['width'],c['text'])
  l=min(a for a,b in pts);r=max(a for a,b in pts)+1;t=min(b for a,b in pts);bottom=max(b for a,b in pts)+1
  dx=(l+r)/2-w/2;dy=(t+bottom)/2-h/2;budget=min(2,(bottom-t)*.1)
  margin=[l,t,w-r,h-bottom];passed=abs(dy)<=budget and min(margin)>=3
  if c['type']=='button':passed=passed and abs(dx)<=budget and h>=44
  results.append({'locale':scene['locale'],'width':scene['width'],'control':i,'type':c['type'],'text':c['text'],'box':[x,y,w,h],'ink':[x+l,y+t,x+r,y+bottom],'margins':margin,'centerError':[dx,dy],'centerBudget':budget,'horizontalAlignment':'center' if c['type']=='button' else 'left','pass':passed})
failed=[r for r in results if not r['pass']]
(E/'ready-local-glyph-pixels.json').write_text(json.dumps({'result':'FAIL' if failed else 'PASS','controls':results,'failures':failed},indent=2),encoding='utf-8')
print(json.dumps({'count':len(results),'failures':failed},ensure_ascii=True))
raise SystemExit(bool(failed))
