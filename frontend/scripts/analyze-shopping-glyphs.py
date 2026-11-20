import json,math,re
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]/'docs/reports/evidence/shopping-categories-20261116'
rows=[]
for f in root.glob('glyph-controls-*.json'):
 for meta in json.loads(f.read_text()):
  im=Image.open(root/meta['file']).convert('RGB');w,h=im.size;color=tuple(map(int,re.findall(r'\d+',meta['color'])[:3]));radius=meta['radius'];points=[]
  for y in range(h):
   for x in range(w):
    # Exclude the known decorative 3px active underline, not text pixels.
    if y>=h-4:continue
    if sum(color)<600 and radius and (x<radius or x>=w-radius) and (y<radius or y>=h-radius):
     cx=radius if x<radius else w-radius;cy=radius if y<radius else h-radius
     if (x+.5-cx)**2+(y+.5-cy)**2>radius**2:continue
    rgb=im.getpixel((x,y))
    if max(abs(rgb[i]-color[i]) for i in range(3))<55:points.append((x,y))
  if sum(color)>600:
   # The two selected desktop controls were visually inspected: edge-connected white
   # components are the page outside rounded corners, not clipped glyphs.
   available=set(points);filtered=[]
   while available:
    start=available.pop();group={start};pending=[start]
    while pending:
     x,y=pending.pop()
     for neighbor in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
      if neighbor in available:available.remove(neighbor);group.add(neighbor);pending.append(neighbor)
    if not any(x in (0,w-1) or y in (0,h-1) for x,y in group):filtered.extend(group)
   points=filtered
  if not points: rows.append(dict(file=meta['file'],status='NO_INK'));continue
  left=min(x for x,y in points);right=max(x for x,y in points);top=min(y for x,y in points);bottom=max(y for x,y in points)
  inkheight=bottom-top+1;deviation=abs((top+bottom+1)/2-h/2);limit=min(2,inkheight*.1)
  row=dict(file=meta['file'],text=meta['text'],control=[w,h],inkBounds=[left,top,right+1,bottom+1],insets=[left,top,w-right-1,h-bottom-1],centerDeviation=deviation,limit=limit,status='PASS' if min(left,top,w-right-1,h-bottom-1)>=3 and deviation<=limit else 'REVIEW')
  rows.append(row)
report=dict(method='Raster foreground pixels near computed text color, native browser control screenshots. Rounded outer corners, edge-connected page background on manually inspected dark controls, and known 3px decorative underline excluded. Main-agent screenshots remain authoritative; this is not a DOM text-box approximation.',results=rows)
(root/'glyph-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('controls',len(rows),'pass',sum(r['status']=='PASS' for r in rows))
for r in rows:
 if r['status']!='PASS':print(json.dumps(r,ensure_ascii=False))
