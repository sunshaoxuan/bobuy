from pathlib import Path
from PIL import Image
import hashlib,json,sys
E=Path(__file__).resolve().parent;prefix=sys.argv[1] if len(sys.argv)>1 else 'candidate';rows=[]
for locale in ['en','ja','cn','tw']:
 for size in ['mobile','desktop']:
  p=E/f'{prefix}-{locale}-{size}.png';image=Image.open(p).convert('RGB');expected=(320,1000) if size=='mobile' else (1440,1000)
  assert image.size==expected,(p,image.size)
  box=(12,350,308,985) if size=='mobile' else (915,80,1420,700)
  crop=image.crop(box);out=p.with_name(p.stem+'-info.png');crop.save(out)
  assert Image.open(out).convert('RGB').tobytes()==crop.tobytes()
  rows.append(dict(parent=p.name,parentSha256=hashlib.sha256(p.read_bytes()).hexdigest(),pixelSize=image.size,crop=out.name,cropBox=box,cropSha256=hashlib.sha256(out.read_bytes()).hexdigest(),originalPixels=True))
(E/f'{prefix}-crop-manifest.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8');print('Verified original-pixel crops:',len(rows))
