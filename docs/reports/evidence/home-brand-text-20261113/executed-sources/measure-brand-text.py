from pathlib import Path
from PIL import Image
import json,sys
root=Path(__file__).parent/'docs/reports/evidence/home-brand-text-20261113';kind=sys.argv[1] if len(sys.argv)>1 else 'local';rows=json.loads((root/kind/'browser.json').read_text(encoding='utf-8'))['rows'];output=[]
for row in rows:
 g=row['geometry'];link=g['link'];image=Image.open(root/kind/f"brand-{row['width']}.png").convert('RGB')
 def ink(part):
  r=g[part];x0=round(r['x']-link['x']);y0=round(r['y']-link['y']);x1=min(image.width,round(x0+r['width']));y1=min(image.height,round(y0+r['height']))
  points=[(x,y) for y in range(y0,y1) for x in range(x0,x1) if max(image.getpixel((x,y)))<180]
  return [min(x for x,y in points),min(y for x,y in points),max(x for x,y in points)+1,max(y for x,y in points)+1]
 name=ink('name');domain=ink('domain');nameMargins=[name[0],name[1],image.width-name[2],image.height-name[3]];domainMargins=[domain[0],domain[1],image.width-domain[2],image.height-domain[3]]
 assert min(nameMargins)>=3 and min(domainMargins)>=3
 assert abs(name[0]-domain[0])<=2 and domain[1]>=name[3] and domain[0]>g['mark']['x']-link['x']+g['mark']['width']
 assert g['link']['height']>=44
 output.append(dict(width=row['width'],link=[image.width,image.height],nameInk=name,domainInk=domain,nameMargins=nameMargins,domainMargins=domainMargins,leftEdgeError=abs(name[0]-domain[0]),nameToDomainGap=domain[1]-name[3],markToTextGap=g['label']['x']-g['mark']['x']-g['mark']['width'],result='PASS'))
(root/kind/'glyphs.json').write_text(json.dumps(output,indent=2)+'\n',encoding='utf-8');print(json.dumps(output))
