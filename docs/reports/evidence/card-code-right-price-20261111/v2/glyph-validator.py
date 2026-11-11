from pathlib import Path
from PIL import Image
import json,math
r=Path(__file__).parent/'docs/reports/evidence/card-code-right-price-20261111/v2'
rows=json.loads((r/'candidate-matrix.json').read_text(encoding='utf-8'));results=[]
for row in rows:
 im=Image.open(r/f"candidate-{row['locale']}-{row['width']}-cards.png").convert('RGB');origin=row['data'][0]['card'];scale=im.width/(row['data'][1]['card']['right']-origin['x'])
 for card in row['data']:
  fields={}
  for key in ['code','amount','unit']:
   box=card[key];x=round((box['x']-origin['x'])*scale);y=round((box['y']-origin['y'])*scale);w=round(box['width']*scale);h=round(box['height']*scale);crop=im.crop((x,y,x+w,y+h));points=[]
   for b in range(h):
    for a in range(w):
     rgb=crop.getpixel((a,b))
     if key=='code':
      radius=h/2;cx=radius if a<radius else w-radius if a>w-radius else a
      if (a+.5-cx)**2+(b+.5-radius)**2>(radius-1.5)**2:continue
      valid=min(rgb)>200
     else:valid=max(rgb)<160
     if valid:points.append((a,b))
   assert points,(row['width'],row['locale'],key)
   left=min(a for a,b in points);right=max(a for a,b in points)+1;top=min(b for a,b in points);bottom=max(b for a,b in points)+1
   fields[key]={'ink':[left,top,right,bottom],'outerMargins':[left,top,w-right,h-bottom],'absoluteRight':(x+right)/scale+origin['x']}
   if key=='code':
    center=abs((top+bottom)/2-h/2);horizontal=abs((left+right)/2-w/2);assert max(center,horizontal)<=min(2,(bottom-top)*.1),(row['width'],row['locale'],center,horizontal)
    assert min(left,top,w-right,h-bottom)>=3
    fields[key]['verticalCenterError']=center
    fields[key]['horizontalCenterError']=horizontal
  fields['priceUnitInkRightDifference']=abs(fields['amount']['absoluteRight']-fields['unit']['absoluteRight']);results.append(dict(width=row['width'],locale=row['locale'],fields=fields))
(r/'glyph-pixels.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8');print('Measured',len(results),'cards; max price/unit ink right difference',max(v['fields']['priceUnitInkRightDifference'] for v in results))
