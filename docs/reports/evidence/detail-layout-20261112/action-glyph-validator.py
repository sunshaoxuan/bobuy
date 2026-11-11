from pathlib import Path
from PIL import Image
import json
r=Path(__file__).parent/'docs/reports/evidence/detail-layout-20261112';rows=json.loads((r/'controls-matrix.json').read_text(encoding='utf-8'));results=[]
for row in rows:
 im=Image.open(r/f"controls-{row['locale']}-{row['width']}.png").convert('RGB')
 for key,box in row['data'].items():
  x=round(box['x']);y=round(box['y']);w=round(box['width']);h=round(box['height']);crop=im.crop((x,y,x+w,y+h));points=[]
  for b in range(3,h-3):
   for a in range(3,w-3):
    if max(crop.getpixel((a,b)))<(235 if key=='action' else 180):points.append((a,b))
  assert points,(row['width'],row['locale'],key)
  l=min(a for a,b in points);right=max(a for a,b in points)+1;t=min(b for a,b in points);bottom=max(b for a,b in points)+1;dx=abs((l+right)/2-w/2);dy=abs((t+bottom)/2-h/2);budget=min(2,(bottom-t)*.1)
  results.append(dict(width=row['width'],locale=row['locale'],control=key,ink=[l,t,right,bottom],margins=[l,t,w-right,h-bottom],centerError=[dx,dy],signedY=(t+bottom)/2-h/2,budget=budget,box=box,passBudget=max(dx,dy)<=budget and min(l,t,w-right,h-bottom)>=3))
(r/'action-glyph-pixels.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8');failures=[v for v in results if not v['passBudget']];print(json.dumps(failures,ensure_ascii=True));assert not failures;print('PASS',len(results),'source/action ink regions')
