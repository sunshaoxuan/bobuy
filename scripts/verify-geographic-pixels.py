"""Measure actual rasterized glyphs in native browser PNGs against fixed budgets.

DOM boxes locate controls and text regions only. Ink bounds come from screenshot
pixels with >=24 RGB-channel contrast to the measured flat background. This is
a geometric measurement, not a visual acceptance decision.
"""
import json
import math
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
out=root/'docs/reports/evidence/geographic-master-20261112'
browser=json.loads((out/'browser.json').read_text(encoding='utf-8'))
assert browser['result']=='PASS'
results=[]
failures=[]
for state in browser['geometry']:
    screenshot=Image.open(out/(state['label']+'-whole.png')).convert('RGB')
    scroll=state['scrollY']
    centers=[]
    for index,control in enumerate(state['controls']):
        background=control['background']; hot=control['hotArea']; layout=control['textLayout']
        if hot['width']==0 or hot['height']==0: continue
        x,y=background['x'],background['y']+scroll
        w,h=background['width'],background['height']
        inner=(x+1,y+1,x+w-1,y+h-1)
        if layout:
            region=(max(inner[0]+1,layout['x']),max(inner[1]+1,layout['y']+scroll),min(inner[2]-1,layout['x']+layout['width']),min(inner[3]-1,layout['y']+scroll+layout['height']))
        else:
            # Pagination arrows are vector icons; bound their actual visible pixels.
            region=(inner[0]+5,inner[1]+5,inner[2]-5,inner[3]-5)
        if control['role']=='select': region=(region[0],region[1],min(region[2],x+w-32),region[3])
        flat=screenshot.getpixel((math.floor(x+w/2),math.ceil(y+5)))
        ink=[]
        for py in range(max(0,math.ceil(region[1])),min(screenshot.height,math.floor(region[3]))):
            for px in range(max(0,math.ceil(region[0])),min(screenshot.width,math.floor(region[2]))):
                color=screenshot.getpixel((px,py))
                if max(abs(a-b) for a,b in zip(color,flat))>=24: ink.append((px,py))
        assert ink,(state['label'],control)
        bounds=(min(p[0] for p in ink),min(p[1] for p in ink),max(p[0] for p in ink)+1,max(p[1] for p in ink)+1)
        vertical=abs((bounds[1]+bounds[3])/2-(inner[1]+inner[3])/2)
        tolerance=min(2,(bounds[3]-bounds[1])*.1)
        margins=[bounds[0]-inner[0],bounds[1]-inner[1],inner[2]-bounds[2],inner[3]-bounds[3]]
        # Select text is left-aligned. Buttons and page numbers use both axes.
        select=control['role']=='select'
        horizontal=None if select else abs((bounds[0]+bounds[2])/2-(inner[0]+inner[2])/2)
        passed=min(margins)>=3 and vertical<=tolerance and (horizontal is None or horizontal<=tolerance) and hot['height']>=44
        entry={'state':state['label'],'control':control['text'] or 'pagination arrow','backgroundUsableInner':inner,'actualInkBounds':bounds,'hotArea':hot,'marginsLeftTopRightBottom':margins,'verticalCenterError':vertical,'horizontalCenterError':horizontal,'allowedCenterError':tolerance,'geometry':'PASS' if passed else 'FAIL'}
        results.append(entry)
        if not passed:failures.append(entry)
        if index>=4:centers.append((bounds[1]+bounds[3])/2)
    if centers and max(centers)-min(centers)>2: failures.append({'state':state['label'],'paginationGlyphCenterDifference':max(centers)-min(centers)})
result={'result':'PASS' if not failures else 'FAIL','method':__doc__,'fixedBudgets':{'inkMargin':3,'centerTolerance':'min(2px, inkHeight * 10%)','hotHeight':44,'adjacentHotGap':6},'measurements':results,'failures':failures}
(out/'pixels.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'result':result['result'],'controlsMeasured':len(results),'failures':failures},ensure_ascii=False))
raise SystemExit(1 if failures else 0)
