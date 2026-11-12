"""Measure rendered foreground pixels inside known browser text regions, retaining raw metrics."""
from pathlib import Path
from PIL import Image
import json,math,re
out=Path(__file__).resolve().parent
data=json.loads((out/'gallery-compiled-final.json').read_text(encoding='utf-8'))
results=[]
for state in data['visualControls']:
 im=Image.open(out/state['screenshot']).convert('RGB')
 for i,control in enumerate(state['controls']):
  r=control['rect'];t=control['textRegion']
  if r['y']<0 or r['y']+r['height']>im.height:continue
  # DOM range is only a search window. Glyph boundaries below come from actual pixels.
  crop=(max(0,math.floor(t['x'])),max(0,math.floor(t['y'])),min(im.width,math.ceil(t['x']+t['width'])),min(im.height,math.ceil(t['y']+t['height'])))
  if crop[2]<=crop[0] or crop[3]<=crop[1]:continue
  color=[int(float(v)) for v in re.findall(r'[\d.]+',control['color'])[:3]]
  bg=[int(float(v)) for v in re.findall(r'[\d.]+',control['background'])[:3]]
  # Only include pixels in an actually visible matching background. Scrolled-away controls
  # can have viewport rectangles over the page header; those are not rendered glyphs.
  sample=im.getpixel((max(0,min(im.width-1,int(r['x']+3))),max(0,min(im.height-1,int(r['y']+3)))))
  if control['role']=='status' and max(abs(sample[k]-bg[k]) for k in range(3))>8:continue
  pixels=[]
  for y in range(crop[1],crop[3]):
   for x in range(crop[0],crop[2]):
    rgb=im.getpixel((x,y))
    if control['role']=='status':
     # Chromium Windows subpixel antialiasing changes channels independently.
     # Use separation from the flat background within the text-only search window.
     if max(abs(bg[k]-rgb[k]) for k in range(3))>25:pixels.append((x,y))
    elif max(abs(rgb[k]-color[k]) for k in range(3))<35:pixels.append((x,y))
  if not pixels:continue
  b=[min(x for x,y in pixels),min(y for x,y in pixels),max(x for x,y in pixels)+1,max(y for x,y in pixels)+1]
  margin=[b[0]-r['x']-1,b[1]-r['y']-1,r['x']+r['width']-1-b[2],r['y']+r['height']-1-b[3]]
  center=(b[1]+b[3])/2-(r['y']+r['height']/2)
  row=dict(width=state['width'],role=control['role'],text=control['text'],backgroundRect=r,usableFrameInset=1,actualGlyphBounds=b,usableMargins=margin,verticalCenterError=center,source=state['screenshot'])
  if control['role']=='status':
   row['budgetPass']=min(margin)>=3 and abs(center)<=min(2,(b[3]-b[1])*.1)
  if control['role']=='disclosure':row['hitHeightPass']=state['width']>=768 or r['height']>=44
  results.append(row)
  im.crop((max(0,int(r['x'])),max(0,int(r['y'])),min(im.width,math.ceil(r['x']+r['width'])),min(im.height,math.ceil(r['y']+r['height'])))).save(out/('glyph-'+str(state['width'])+'-'+str(i)+'.png'))
# Retain a full native-size status-region crop from each viewport.
for width in [1440,768,320]:
 im=Image.open(out/f'gallery-partial-status-{width}.png')
 im.crop((31 if width==320 else 53 if width==768 else 373,317 if width==320 else 220,274 if width==320 else width-68,810 if width==320 else 900)).save(out/f'gallery-status-crop-{width}.png')
(out/'glyph-metrics.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps([r for r in results if r.get('budgetPass') is False or r.get('hitHeightPass') is False],indent=2))
