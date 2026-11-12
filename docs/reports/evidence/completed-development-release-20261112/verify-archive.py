"""Read Git blobs in one batch; never apply text decoding to archived evidence bytes."""
from pathlib import Path
import hashlib,json,subprocess,sys
out=Path(__file__).resolve().parent;root=out.parents[3];revision=sys.argv[1] if len(sys.argv)>1 else 'HEAD'
manifest=json.loads((out/'evidence-manifest.json').read_text(encoding='utf-8'))['files']
prefix=out.relative_to(root).as_posix()+'/'
data=subprocess.check_output(['git','cat-file','--batch'],input=''.join(revision+':'+prefix+name+'\n' for name in manifest).encode(),cwd=root)
cursor=0;mismatches=[]
for name,expected in manifest.items():
 end=data.index(b'\n',cursor);header=data[cursor:end].split();assert header[1]==b'blob',name
 size=int(header[2]);start=end+1;blob=data[start:start+size];cursor=start+size+1
 if hashlib.sha256(blob).hexdigest()!=expected:mismatches.append(name)
print(json.dumps(dict(result='FAIL' if mismatches else 'PASS',revision=revision,files=len(manifest),mismatches=mismatches)))
raise SystemExit(bool(mismatches))
