from pathlib import Path
from PIL import Image
import json, math, statistics, sys
r=Path('docs/reports/evidence/editor-layout-20261112');results=[];failures=[];gaps=[]
for file in sorted(r.glob((sys.argv[1] if len(sys.argv)>1 else 'local')+'-*.json')):
 if file.name.endswith('-matrix.json'):continue
 data=json.loads(file.read_text(encoding='utf-8'))
 if not isinstance(data,dict) or not isinstance(data.get('controls'),list):continue
 im=Image.open(file.with_suffix('.png')).convert('RGB')
 for i,a in enumerate(data['controls']):
  for b in data['controls'][i+1:]:
   ar,br=a['rect'],b['rect']
   if abs(ar['y']+ar['height']/2-br['y']-br['height']/2)<=2:
    left,right=sorted([ar,br],key=lambda box:box['x']);gap=right['x']-left['x']-left['width'];gaps.append({'file':file.name,'labels':[a['label'],b['label']],'gap':gap})
    if gap<6:failures.append({'file':file.name,'labels':[a['label'],b['label']],'gap':gap})
 for c in data['controls']:
  b=c['rect'];x,y,w,h=[b[k] for k in ('x','y','width','height')]
  # Exclude the 1px outline and rounded corners. Detect visible text/icon ink
  # against the actual central background, including antialiased glyph edges.
  points=[];bg=im.getpixel((round(x+w/2),round(y+5)))
  for yy in range(math.ceil(y+5),math.floor(y+h-5)):
   for xx in range(math.ceil(x+5),math.floor(x+w-5)):
    p=im.getpixel((xx,yy))
    if sum(abs(a-b) for a,b in zip(p,bg))>=60:points.append((xx,yy))
  if not points:failures.append({'file':file.name,'label':c['label'],'reason':'no ink'});continue
  box=[min(a for a,b in points),min(b for a,b in points),max(a for a,b in points)+1,max(b for a,b in points)+1]
  dx=abs((box[0]+box[2])/2-(x+w/2));dy=abs((box[1]+box[3])/2-(y+h/2));budget=min(2,(box[3]-box[1])*.1)
  margins=[box[0]-x-1,box[1]-y-1,x+w-1-box[2],y+h-1-box[3]]
  result={'file':file.name,'label':c['label'],'background':[x,y,w,h],'usableInset':1,'ink':box,'centerError':[dx,dy],'budget':budget,'margins':margins,'height':h,'pass':h>=44-.01 and max(dx,dy)<=budget and min(margins)>=3}
  results.append(result)
  if not result['pass']:failures.append(result)
assert len(results)==132,len(results)
out={'result':'PASS' if not failures else 'FAIL','controls':len(results),'measurements':results,'sameRowHotAreaGaps':gaps,'failures':failures};(r/(sys.argv[2] if len(sys.argv)>2 else 'control-pixels.json')).write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8');print(json.dumps({'controls':len(results),'failures':failures},ensure_ascii=True));assert not failures
