from pathlib import Path
from PIL import Image
import json,sys
root=Path(__file__).parent/'docs/reports/evidence/offer-period-presentation-20261113';kind=sys.argv[1] if len(sys.argv)>1 else 'local';rows=json.loads((root/kind/'browser.json').read_text(encoding='utf-8'))['views'];result=[]
for v in rows:
 if v.get('synthetic'):continue
 im=Image.open(root/kind/f"hint-text-{v['width']}.png").convert('RGB');points=[]
 for y in range(im.height):
  for x in range(im.width):
   cx,cy=x+.5,y+.5
   if not(1<=cx<=im.width-1 and 1<=cy<=im.height-1):continue
   cornerX=8 if cx<8 else im.width-8 if cx>im.width-8 else None
   cornerY=8 if cy<8 else im.height-8 if cy>im.height-8 else None
   if cornerX is not None and cornerY is not None and (cx-cornerX)**2+(cy-cornerY)**2>7**2:continue
   r,g,b=im.getpixel((x,y));dr=255-r;dg=248-g
   db=242-b
   # Segment the declared brown text against the cream background. Rounded
   # corners expose unrelated card/image pixels, which are not tooltip glyphs.
   if r<242 and g<235 and dg>0 and db>0 and .75<dr/dg<.95 and .96<dg/db<1.00:points.append((x,y))
 assert points
 left=min(x for x,y in points);right=max(x for x,y in points)+1;top=min(y for x,y in points);bottom=max(y for x,y in points)+1
 margins=[left-1,top-1,im.width-1-right,im.height-1-bottom]
 assert min(margins)>=3, margins
 gap=v['geometry']['x']-(v['badgeBox']['x']+v['badgeBox']['width']);assert gap>=6
 result.append(dict(width=v['width'],background=[im.width,im.height],availableFrame=[1,1,im.width-1,im.height-1],roundedBackgroundRadius=8,actualGlyph=[left,top,right,bottom],margins=margins,gapToBadge=gap,layout='left-aligned multiple lines, no centering requirement',result='PASS'))
(root/kind/'glyphs.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
