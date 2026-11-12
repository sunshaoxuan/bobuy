from pathlib import Path
from PIL import Image
import json
folder=Path(__file__).resolve().parents[1]/'docs/reports/evidence/daily-product-offer-tags-20261112/detail-period-20261113/local'
results=[]
for width in [1440,360]:
 im=Image.open(folder/f'period-{width}.png').convert('RGB')
 def bounds(points):return [min(x for x,y in points),min(y for x,y in points),max(x for x,y in points)+1,max(y for x,y in points)+1]
 badge=bounds([(x,y) for y in range(3,27) for x in range(3,27) if min(im.getpixel((x,y)))>230])
 text=bounds([(x,y) for y in range(im.height) for x in range(38,im.width) if max(im.getpixel((x,y)))<180])
 delta=abs((badge[1]+badge[3]-text[1]-text[3])/2);limit=min(2,(text[3]-text[1])*.1)
 assert delta<=limit and min(badge[0],badge[1],30-badge[2],30-badge[3])>=3
 results.append({'viewport':width,'badgeGlyph':badge,'periodGlyph':text,'glyphCenterDifference':delta,'limit':limit})
(folder/'glyphs.json').write_text(json.dumps({'result':'PASS','method':'Actual final screenshot ink bounds, white glyph inside red badge and dark date glyph on white background','measurements':results},indent=2),encoding='utf-8');print(json.dumps(results))
