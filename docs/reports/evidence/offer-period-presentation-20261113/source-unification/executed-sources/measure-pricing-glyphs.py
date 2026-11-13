from pathlib import Path
from PIL import Image
import json
r=Path(__file__).parent/'docs/reports/evidence/offer-period-presentation-20261113/source-unification/local'
results=[]
for width,rects in [(320,[(112,15,204,59),(212,15,304,59)]),(1440,[(784,17,876,57),(884,17,976,57)])]:
 im=Image.open(r/f'footer-{width}.png').convert('RGB')
 for label,(x,y,right,bottom) in zip(['close','save'],rects):
  pixels=[]
  for yy in range(y+4,bottom-4):
   for xx in range(x+4,right-4):
    p=im.getpixel((xx,yy))
    if max(p)<210:pixels.append((xx,yy))
  assert pixels
  a,b,c,d=min(p[0] for p in pixels),min(p[1] for p in pixels),max(p[0] for p in pixels)+1,max(p[1] for p in pixels)+1
  margins=[a-(x+1),b-(y+1),(right-1)-c,(bottom-1)-d];offset=[abs((a+c-x-right)/2),abs((b+d-y-bottom)/2)]
  assert min(margins)>=3 and max(offset)<=min(2,(d-b)*.1),(width,label,margins,offset)
  results.append(dict(viewport=width,label=label,background=[x,y,right,bottom],inner=[x+1,y+1,right-1,bottom-1],glyph=[a,b,c,d],margins=margins,centerOffset=offset,heatHeight=bottom-y,adjacentHeatGap=8))
(r/'footer-glyphs.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8');print(json.dumps(results))
