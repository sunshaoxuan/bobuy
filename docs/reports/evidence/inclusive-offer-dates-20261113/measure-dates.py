from pathlib import Path
from PIL import Image
import json
e=Path(__file__).parent;values=[]
for width,rects in [(1440,[(21,134,468,168),(484,134,931,168)]),(320,[(17,152,271,196),(17,240,271,284)])]:
 im=Image.open(e/f'production/dates-{width}.png').convert('RGB')
 for label,(x,y,right,bottom) in zip(['start','end'],rects):
  points=[(xx,yy) for yy in range(y+4,bottom-4) for xx in range(x+4,right-40) if max(im.getpixel((xx,yy)))<180]
  assert points
  a,b,c,d=min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points)+1,max(p[1] for p in points)+1
  v=dict(viewport=width,control=label,background=[x,y,right,bottom],availableInner=[x+1,y+1,right-1,bottom-1],glyph=[a,b,c,d],margins=[a-x-1,b-y-1,right-1-c,bottom-1-d],verticalCenterOffset=abs((b+d-y-bottom)/2),heatHeight=bottom-y,role='left aligned date input; native calendar icon separate')
  assert min(v['margins'])>=3 and v['verticalCenterOffset']<=min(2,(d-b)*.1),(v,im.size)
  values.append(v)
(e/'production/glyphs.json').write_text(json.dumps(values,indent=2)+'\n',encoding='utf-8');print(json.dumps(values))
