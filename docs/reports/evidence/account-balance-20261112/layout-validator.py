"""Check predeclared composition budgets against actual browser geometry."""
from pathlib import Path
import copy,json,subprocess,hashlib
ROOT=Path(__file__).parent
def desktop(data):
 b,a,v=[data['boxes'][n] for n in ['basic','address','verification']]
 return not data['overflow'] and abs(b['x']-v['x'])<=2 and abs(v['y']-b['bottom']-20)<=.1 and abs(a['bottom']-v['bottom'])<=2 and a['x']>=b['x']+b['width']+20-.1
def mobile(data):
 boxes=[data['boxes'][n] for n in ['basic','verification','address','social','save']]
 return not data['overflow'] and all(abs(r['x']-boxes[0]['x'])<=2 and abs(r['width']-boxes[0]['width'])<=2 and r['x']>=16 for r in boxes) and all(b['y']>=a['bottom']+16-.1 for a,b in zip(boxes,boxes[1:]))
d=json.loads((ROOT/'accepted-desktop-top.json').read_text(encoding='utf-8'))
p=json.loads((ROOT/'accepted-phone390-top.json').read_text(encoding='utf-8'))
assert desktop(d) and mobile(p),'Positive actual page failed'
old_gap=copy.deepcopy(d);old_gap['boxes']['verification']['y']=old_gap['boxes']['basic']['bottom']+400
two_columns=copy.deepcopy(p);two_columns['boxes']['verification']['x']+=100
assert not desktop(old_gap),'Large empty-gap negative was accepted'
assert not mobile(two_columns),'Phone second-column negative was accepted'
result={'scope':'geometry only; screenshot review required separately','desktop':'PASS','phone390':'PASS','largeGapNegative':'REJECTED','phoneTwoColumnNegative':'REJECTED','actualDesktopGap':d['boxes']['verification']['y']-d['boxes']['basic']['bottom'],'actualColumnBottomDifference':abs(d['boxes']['address']['bottom']-d['boxes']['verification']['bottom'])}
(ROOT/'layout-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
baseline='d2ffb059bad921de51d2b61267095e52e6357c42'
integrated='deac521fdb5c10e4accc2d4cc368fb494ab61801'
files=['frontend/src/pages/AccountProfile.tsx','frontend/src/account.css','frontend/package-lock.json','frontend/nginx.conf','frontend/vite.config.ts']
bindings={}
for path in files:
 before=subprocess.check_output(['git','show',baseline+':'+path])
 after=subprocess.check_output(['git','show',integrated+':'+path])
 assert before==after,path+' changed after layout acceptance'
 bindings[path]=hashlib.sha256(after).hexdigest()
(ROOT/'integrated-source-binding.json').write_text(json.dumps({'acceptedLayoutSource':baseline,'integratedSource':integrated,'unchanged':bindings},indent=2),encoding='utf-8')
