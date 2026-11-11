"""Measure actual screenshot ink and SVG path bounds against the task's fixed pixel budgets."""
from pathlib import Path
from PIL import Image
import json,math
root=Path(__file__).resolve().parents[1]/'docs/reports/evidence/product-engagement'
geometry=json.loads((root/'geometry.json').read_text(encoding='utf-8'))
report={'method':'Native select and heat: actual screenshot foreground pixels. Rating: final SVG path bounds transformed into browser pixels, independent role=radio hotzones.','checks':[]}
for item in geometry:
 if item['name'] not in ('sort','heat'):continue
 image=Image.open(root/item['file']).convert('RGB');width,height=image.size
 region=(2,2,width-30,height-2) if item['name']=='sort' else (0,0,width,height)
 points=[]
 for y in range(region[1],region[3]):
  for x in range(region[0],region[2]):
   r,g,b=image.getpixel((x,y))
   ink=max(r,g,b)<120 if item['name']=='sort' else r>g+3 and g>b+3 and g<220
   if ink:points.append((x,y))
 assert points,item['file']
 left,top,right,bottom=min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points)+1,max(p[1] for p in points)+1
 border=1 if item['name']=='sort' else 0
 margins=[left-border,top-border,width-border-right,height-border-bottom]
 assert min(margins)>=3,(item['file'],margins)
 error=abs((top+bottom)/2-height/2);limit=min(2,(bottom-top)*.1)
 if item['name']=='sort':assert error<=limit,(item['file'],error,limit)
 report['checks'].append({'file':item['file'],'background':[width,height],'visibleInk':[left,top,right,bottom],'marginsLTRBottom':margins,'verticalCenterError':error,'verticalBudget':limit if item['name']=='sort' else 'baseline-aligned status, no centering requirement','result':'PASS'})
browser=json.loads((root/'browser.json').read_text(encoding='utf-8'))
for name in ['review-textarea-max-320.png','review-textarea-max-end-320.png']:
 image=Image.open(root/name).convert('RGB');width,height=image.size
 scrollbar=int(browser['checks']['reviewScrollViewport']['before']['scrollbarWidth'])
 points=[(x,y) for y in range(1,height-1) for x in range(1,width-1-scrollbar) if max(image.getpixel((x,y)))<130]
 assert points,name
 left,top,right,bottom=min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points)+1,max(p[1] for p in points)+1
 margins=[left-1,top-1,width-1-scrollbar-right,height-1-bottom]
 assert min(margins)>=3,(name,margins)
 report['checks'].append({'file':name,'background':[width,height],'scrollbarWidth':scrollbar,'visibleInk':[left,top,right,bottom],'marginsLTRBottom':margins,'result':'PASS: complete text rows retain glyph clearance at both scroll boundaries'})
for state in browser['geometry']:
 if not state['name'].startswith('stars'):continue
 for control in state['data']:
  if 'ant-rate' not in control['control']:continue
  zones=control['hotzones']
  for index,zone in enumerate(zones):
   assert zone['height']>=44
   if index:assert zone['x']-(zones[index-1]['x']+zones[index-1]['width'])>=6
   assert zone['icons'],'Missing actual star path geometry'
   for icon in zone['icons']:
    margins=[icon['x']-zone['x'],icon['y']-zone['y'],zone['right']-icon['x']-icon['width'],zone['bottom']-icon['y']-icon['height']]
    errors=[abs(icon['x']+icon['width']/2-zone['x']-zone['width']/2),abs(icon['y']+icon['height']/2-zone['y']-zone['height']/2)]
    limit=min(2,icon['height']*.1)
    assert min(margins)>=3,(state['name'],index,margins)
    assert max(errors)<=limit,(state['name'],index,errors,limit)
    report['checks'].append({'file':state['name']+'.png','star':index+1,'hotzone':zone,'visiblePath':icon,'marginsLTRBottom':margins,'centerErrorsXY':errors,'budget':limit,'result':'PASS'})
(root/'pixels.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('PIXEL_BUDGET_PASS',len(report['checks']))
