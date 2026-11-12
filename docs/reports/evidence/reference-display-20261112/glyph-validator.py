from pathlib import Path
from PIL import Image
import json,sys,math
r=Path(__file__).resolve().parent;label=sys.argv[1] if len(sys.argv)>1 else 'candidate-final';rows=json.loads((r/f'{label}-matrix.json').read_text(encoding='utf-8'));results=[]
for row in rows:
 kind='catalog' if row['route'].startswith('products') else 'recommendation'
 im=Image.open(r/f"{label}-{kind}-{row['locale']}-{row['width']}-whole.png").convert('RGB')
 for key in ['code','close']:
  box=row['metrics'][key];x,y,w,h=[round(box[k]) for k in ['x','y','width','height']];crop=im.crop((x,y,x+w,y+h));points=[]
  for b in range(h):
   for a in range(w):
    rgb=crop.getpixel((a,b))
    if key=='code':
     radius=h/2;cx=radius if a<radius else w-radius if a>w-radius else a
     if (a+.5-cx)**2+(b+.5-radius)**2>(radius-1.5)**2:continue
     valid=min(rgb)>200
    else:valid=max(rgb)<190
    if valid:points.append((a,b))
  assert points
  l=min(a for a,b in points);rr=max(a for a,b in points)+1;t=min(b for a,b in points);bb=max(b for a,b in points)+1;dx=abs((l+rr)/2-w/2);dy=abs((t+bb)/2-h/2);budget=min(2,(bb-t)*.1)
  assert max(dx,dy)<=budget and min(l,t,w-rr,h-bb)>=3,(row['locale'],row['width'],key,dx,dy,budget)
  clearance=min((h/2-math.hypot(a+.5-(h/2 if a<h/2 else w-h/2),b+.5-h/2)) if key=='code' and (a<h/2 or a>w-h/2) else min(a+.5,w-a-.5,b+.5,h-b-.5) for a,b in points);assert clearance>=3
  results.append(dict(locale=row['locale'],width=row['width'],route=kind,control=key,ink=[l,t,rr,bb],usableFrame=dict(shape='round-rect' if key=='code' else 'rect',rect=[0,0,w,h],radius=h/2 if key=='code' else 0),minimumActualBackgroundClearance=clearance,innerMargins=[l,t,w-rr,h-bb],centerError=[dx,dy],budget=budget))
(r/('glyph-pixels.json' if label=='candidate-final' else label+'-glyph-pixels.json')).write_text(json.dumps(results,indent=2)+'\n');print('PASS',len(results),'actual glyph and close-icon regions')
