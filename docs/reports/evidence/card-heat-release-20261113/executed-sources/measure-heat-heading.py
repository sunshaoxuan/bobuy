from pathlib import Path
from PIL import Image
import json,math,sys
root=Path(__file__).parent/'docs/reports/evidence/card-heat-release-20261113';kind=sys.argv[1] if len(sys.argv)>1 else 'local';data=json.loads((root/kind/'browser.json').read_text(encoding='utf-8'));result=[]
for view in data['views']:
 image=Image.open(root/kind/view['screenshot'].replace('.png','-card.png')).convert('RGB');g=view['geometry'][0];card=g['card'];boxes={}
 for name in ['heat','code']:
  b=g[name];left=b['x']-math.floor(card['x']);top=b['y']-math.floor(card['y']);right=b['right']-math.floor(card['x']);bottom=b['bottom']-math.floor(card['y']);points=[]
  for y in range(round(top)+(4 if name=='code' else 0),round(bottom)-(4 if name=='code' else 0)):
   for x in range(round(left)+(6 if name=='code' else 0),round(right)-(6 if name=='code' else 0)):
    r,gg,bb=image.getpixel((x,y));match=(min(r,gg,bb)>225) if name=='code' else (70<r<230 and r>gg*1.2 and gg>bb*1.2)
    if match:points.append((x,y))
  assert points
  x0=min(x for x,y in points);x1=max(x for x,y in points)+1;y0=min(y for x,y in points);y1=max(y for x,y in points)+1
  margins=[x0-left,y0-top,right-x1,bottom-y1];assert min(margins)>=3
  boxes[name]=dict(ink=[x0,y0,x1,y1],frame=[left,top,right,bottom],margins=margins,centerY=(y0+y1)/2)
 heat=boxes['heat'];error=abs(heat['centerY']-(heat['frame'][1]+heat['frame'][3])/2);assert error<=min(2,(heat['ink'][3]-heat['ink'][1])*.1)
 centerDifference=abs(boxes['code']['centerY']-heat['centerY'])
 result.append(dict(route=view['route'],width=view['width'],admin=view['admin'],screenshot=view['screenshot'],boxes=boxes,heatFrameCenterError=error,codeHeatGlyphCenterDifference=centerDifference,frameGap=g['heat']['x']-g['code']['right'],result='PASS'))
(root/kind/'heading-pixels.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps([dict(route=r['route'],width=r['width'],admin=r['admin'],heatError=r['heatFrameCenterError'],glyphCenterDifference=r['codeHeatGlyphCenterDifference']) for r in result]))
