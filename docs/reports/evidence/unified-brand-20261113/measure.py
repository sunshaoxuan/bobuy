from pathlib import Path
from PIL import Image
import json,math,sys
e=Path(__file__).parent/(sys.argv[1] if len(sys.argv)>1 else 'local');data=json.loads((e/'browser.json').read_text(encoding='utf-8'));results=[];failed=[]
for v in data['views']:
 im=Image.open(e/(v['name']+'-text.png')).convert('RGB');g=v['geometry'];bounds={}
 for key in ['name','domain']:
  rect=g[key];top=max(0,math.floor(rect['y']-g['label']['y']));bottom=min(im.height,math.ceil(rect['bottom']-g['label']['y']));pixels=[(x,y) for y in range(top,bottom) for x in range(im.width) if max(im.getpixel((x,y)))<180];assert pixels
  bounds[key]=[min(p[0] for p in pixels),min(p[1] for p in pixels),max(p[0] for p in pixels)+1,max(p[1] for p in pixels)+1]
 left=abs(bounds['name'][0]-bounds['domain'][0]);right=abs(bounds['name'][2]-bounds['domain'][2]);allGlyph=[min(b[0] for b in bounds.values()),min(b[1] for b in bounds.values()),max(b[2] for b in bounds.values()),max(b[3] for b in bounds.values())];origin=[math.floor(g['label']['x']),math.floor(g['label']['y'])];safety=[origin[0]+allGlyph[0]-math.ceil(g['link']['x']),origin[1]+allGlyph[1]-math.ceil(g['link']['y']),math.floor(g['link']['right'])-origin[0]-allGlyph[2],math.floor(g['link']['bottom'])-origin[1]-allGlyph[3]]
 item=dict(name=v['name'],glyphs=bounds,leftError=left,rightError=right,linkGlyphMargins=safety,linkHeight=g['link']['height'],columnGap=g['label']['x']-g['mark']['right'],result='PASS' if max(left,right)<=1 and min(safety)>=3 else 'FAIL');results.append(item)
 if item['result']=='FAIL':failed.append(item)
(e/'glyphs.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8');print(json.dumps(results));sys.exit(1 if failed else 0)
