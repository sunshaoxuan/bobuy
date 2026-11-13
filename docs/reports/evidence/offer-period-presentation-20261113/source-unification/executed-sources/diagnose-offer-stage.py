from pathlib import Path
import json
import importlib.util
spec=importlib.util.spec_from_file_location('client',Path(__file__).with_name('release-offer-source.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
code='''from pathlib import Path
import hashlib,io,json,zipfile
p=Path('/opt/bobuy/releases/20261113.offer-source-drawer.1')
def migrations(file):
 with zipfile.ZipFile(file) as z:
  found={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if 'db/migration/' in n and n.endswith('.sql')}
  for n in z.namelist():
   if n.startswith('BOOT-INF/lib/bobbuy-common-') and n.endswith('.jar'):found.update(migrations(io.BytesIO(z.read(n))))
  return found
a=migrations(p/'baseline-core.jar');b=migrations(p/'app.jar');print(json.dumps(dict(oldCount=len(a),newCount=len(b),oldOnly=sorted(set(a)-set(b)),newOnly=sorted(set(b)-set(a)),changed=[k for k in a.keys()&b.keys() if a[k]!=b[k]])))
'''
v=json.loads(m.remote(code));m.write('migration-diagnosis.json',v);print(json.dumps(v))
detail='''from pathlib import Path
import io,zipfile,difflib,json,hashlib
p=Path('/opt/bobuy/releases/20261113.offer-source-drawer.1')
def content(file):
 with zipfile.ZipFile(file) as z:
  for n in z.namelist():
   if n.startswith('BOOT-INF/lib/bobbuy-common-') and n.endswith('.jar'):
    with zipfile.ZipFile(io.BytesIO(z.read(n))) as inner:return inner.read('db/migration/V35__price_adjustment_documents.sql')
a=content(p/'baseline-core.jar');b=content(p/'app.jar');print(json.dumps(dict(oldBytes=len(a),newBytes=len(b),normalizedEqual=a.replace(b'\\r\\n',b'\\n')==b.replace(b'\\r\\n',b'\\n'),diff=list(difflib.unified_diff(a.decode().splitlines(),b.decode().splitlines(),n=2)))))
'''
d=json.loads(m.remote(detail));m.write('migration-byte-diagnosis.json',d);print(json.dumps(d))
