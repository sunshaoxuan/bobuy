from pathlib import Path
from PIL import Image
import json,math
p=Path(__file__).parent;rows=[]
for version in ['before','after']:
 d=json.loads((p/(version+'.json')).read_text())
 for r in d['results']:
  if r['width']>400:continue
  for name in ['all','single','two']:
   g=r['states'][name];im=Image.open(p/f'{version}-{name}-{r["width"]}.png').convert('RGB');bg=g['background'];bounds={}
   for part in ['image','label']:
    q=g[part];pts=[]
    for y in range(math.ceil(q['y']),math.floor(q['bottom'])):
     for x in range(math.ceil(q['x']),math.floor(q['right'])):
      rgb=im.getpixel((x,y))
      if max(rgb)<175 and (part=='image' or max(rgb)-min(rgb)<15):pts.append((x,y))
    assert pts,(version,name,part)
    bounds[part]={'left':min(x for x,y in pts),'top':min(y for x,y in pts),'rightExclusive':max(x for x,y in pts)+1,'bottomExclusive':max(y for x,y in pts)+1}
   rows.append({'version':version,'width':r['width'],'state':name,'visualHeight':bg['height'],'iconInkTopInset':bounds['image']['top']-bg['y'],'textAndUnderlineBottomInset':bg['bottom']-bounds['label']['bottomExclusive'],'bounds':bounds})
def lum(rgb):
 vals=[x/255 for x in rgb];vals=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in vals];return sum(x*y for x,y in zip(vals,[.2126,.7152,.0722]))
ratio=(lum([244,243,240])+.05)/(lum([36,36,36])+.05)
(p/'ink.json').write_text(json.dumps({'method':'DPR1 original PNG; icon pixels all channels <175; text/underline pixels all channels <175 and channel spread<15; excludes line box whitespace and background/border. Insets may be fractional at CSS edges.','contrast':ratio,'rows':rows},ensure_ascii=False,indent=2)+'\n')
print('Text contrast',round(ratio,2))
for r in rows:print({k:v for k,v in r.items() if k!='bounds'})
