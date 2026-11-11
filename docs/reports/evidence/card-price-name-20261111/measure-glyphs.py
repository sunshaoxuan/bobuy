from pathlib import Path
from PIL import Image
import json,math
r=Path(__file__).parent/'docs/reports/evidence/card-price-name-20261111'
rows=json.loads((r/'final-matrix.json').read_text(encoding='utf-8'));result=[]
for row in rows:
 image=Image.open(r/f"final-{row['locale']}-{row['width']}-cards.png").convert('RGB');origin=row['data'][0]['card'];scale=image.width/(row['data'][1]['card']['right']-origin['x'])
 for card in row['data']:
  for key in ['heading','native']:
   box=card[key]
   if box is None:continue
   x=round((box['x']-origin['x'])*scale);y=round((box['y']-origin['y'])*scale);w=round(box['width']*scale);h=round(box['height']*scale)
   crop=image.crop((x,y,x+w,y+h));points=[(a,b) for b in range(h) for a in range(w) if min(crop.getpixel((a,b)))<130]
   if not points:continue
   left=min(a for a,b in points)+x;right=max(a for a,b in points)+x+1;top=min(b for a,b in points)+y;bottom=max(b for a,b in points)+y+1
   button=card['name'];bounds={'left':(left/scale+origin['x'])-button['x'],'right':button['right']-(right/scale+origin['x']),'top':(top/scale+origin['y'])-button['y'],'bottom':button['bottom']-(bottom/scale+origin['y'])}
   assert min(bounds.values())>=2.9,(row['width'],row['locale'],key,bounds)
   result.append(dict(width=row['width'],locale=row['locale'],field=key,ink=[left,top,right,bottom],buttonInsets=bounds,alignment='start; center budget not applicable'))
(r/'glyph-pixels.json').write_text(json.dumps(result,indent=2)+'\n');print('PASS',len(result),'actual screenshot ink regions')
