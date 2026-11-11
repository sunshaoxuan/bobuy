from pathlib import Path
from PIL import Image
import json,math
r=Path(__file__).parent/'docs/reports/evidence/detail-layout-20261112';rows=json.loads((r/'candidate-matrix.json').read_text(encoding='utf-8'));result=[]
for row in rows:
 im=Image.open(r/f"candidate-{row['locale']}-{row['width']}-top.png").convert('RGB')
 for key in ['code','close']:
  box=row['metrics'][key];x=round(box['x']);y=round(box['y']);w=round(box['width']);h=round(box['height']);crop=im.crop((x,y,x+w,y+h));points=[]
  for b in range(h):
   for a in range(w):
    rgb=crop.getpixel((a,b))
    if key=='code':
     radius=h/2;cx=radius if a<radius else w-radius if a>w-radius else a
     if (a+.5-cx)**2+(b+.5-radius)**2>(radius-1.5)**2:continue
     valid=min(rgb)>200
    else:valid=max(rgb)<190
    if valid:points.append((a,b))
  assert points,(row['locale'],row['width'],key)
  l=min(a for a,b in points);right=max(a for a,b in points)+1;t=min(b for a,b in points);bottom=max(b for a,b in points)+1;dx=abs((l+right)/2-w/2);dy=abs((t+bottom)/2-h/2);budget=min(2,(bottom-t)*.1)
  assert max(dx,dy)<=budget,(row['locale'],row['width'],key,dx,dy,budget)
  assert min(l,t,w-right,h-bottom)>=3,(row['locale'],row['width'],key,box,[l,t,w-right,h-bottom])
  result.append(dict(locale=row['locale'],width=row['width'],control=key,ink=[l,t,right,bottom],innerMargins=[l,t,w-right,h-bottom],centerError=[dx,dy],budget=budget))
(r/'glyph-pixels.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print('PASS',len(result),'actual glyph and close-icon regions')
