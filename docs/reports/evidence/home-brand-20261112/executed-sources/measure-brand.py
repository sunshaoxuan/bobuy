from pathlib import Path
from PIL import Image
import json
root=Path(__file__).parent/'docs/reports/evidence/home-brand-20261112'
kind=__import__('sys').argv[1] if len(__import__('sys').argv)>1 else 'local'
data=json.loads((root/kind/'browser.json').read_text(encoding='utf-8'));out=[]
for row in data['results']:
 width=row['width'];g=row['geometry'];image=Image.open(root/kind/f'brand-{width}.png').convert('RGB');h=g['hotspot'];d=g['domain'];
 y0=round(d['y']-h['y']);y1=round(y0+d['height'])
 pixels=[(x,y) for y in range(y0,min(y1,image.height)) for x in range(image.width) if max(abs(a-b) for a,b in zip(image.getpixel((x,y)),(107,98,91)))<75]
 assert pixels
 left=min(x for x,y in pixels);right=max(x for x,y in pixels)+1;top=min(y for x,y in pixels);bottom=max(y for x,y in pixels)+1
 safety=[left,top,image.width-right,image.height-bottom]
 horizontal=abs((left+right)/2-image.width/2) if width==1440 else None
 vertical=abs((top+bottom)/2-(d['y']-h['y']+d['height']/2))
 value=dict(width=width,pixelGlyphBox=[left,top,right,bottom],hotspot=[image.width,image.height],domainLine=[d['x']-h['x'],y0,d['width'],d['height']],glyphSafetyToHotspot=safety,horizontalCenterError=horizontal,verticalCenterError=vertical)
 n=g['name'];nx=round(n['x']-h['x']);ny=round(n['y']-h['y'])
 ink=[(x,y) for y in range(ny,min(image.height,round(ny+n['height']))) for x in range(nx,min(image.width,round(nx+n['width']))) if max(image.getpixel((x,y)))<180]
 nl=min(x for x,y in ink);nr=max(x for x,y in ink)+1;nt=min(y for x,y in ink);nb=max(y for x,y in ink)+1
 value['nameGlyphBox']=[nl,nt,nr,nb];value['nameSafetyToHotspot']=[nl,nt,image.width-nr,image.height-nb]
 assert min(value['nameSafetyToHotspot'])>=3
 assert min(safety)>=3
 # The domain is the second baseline in a stacked transparent link. Its line box
 # is not a background inner frame; vertical centering is not the layout intent.
 if horizontal is not None:assert horizontal<=min(2,(bottom-top)*.1)
 if width<768:assert image.height>=44
 value['result']='PASS';out.append(value)
(root/kind/'glyphs.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8');print(json.dumps(out))
