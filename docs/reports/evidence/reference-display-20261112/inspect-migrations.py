from pathlib import Path
import zipfile,io,json,difflib
p=Path('/opt/bobuy/releases/20261112.reference-display.4')
def sqls(file):
 result={}
 def read(z):
  for n in z.namelist():
   if 'db/migration/' in n and n.endswith('.sql'):result[n.split('db/migration/')[-1]]=z.read(n)
   elif n.endswith('.jar') and 'bobbuy' in n:
    with zipfile.ZipFile(io.BytesIO(z.read(n))) as inner:read(inner)
 with zipfile.ZipFile(file) as z:read(z)
 return result
a,b=sqls(p/'baseline-app.jar'),sqls(p/'app.jar')
for n in a:
 if a[n]!=b[n]:
  x,y=a[n].decode('utf-8-sig'),b[n].decode('utf-8-sig')
  print(json.dumps(dict(name=n,beforeBytes=len(a[n]),afterBytes=len(b[n]),beforeCRLF=x.count('\r\n'),afterCRLF=y.count('\r\n'),sameLines=x.splitlines()==y.splitlines(),diff=list(difflib.unified_diff(x.splitlines(),y.splitlines())))))
