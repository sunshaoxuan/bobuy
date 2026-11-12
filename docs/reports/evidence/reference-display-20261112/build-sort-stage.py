from pathlib import Path
import json,hashlib,tarfile,subprocess
p=Path('/opt/bobuy/releases/20261112.reference-sort');assert p.is_dir() and not p.is_symlink();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(p/'payload.tar')=='ce37012929c1bfc188a14e0b0afaed6675471e2f2d9571b210d757013afc949b'
with tarfile.open(p/'payload.tar') as t:
 for m in t.getmembers():assert (p/m.name).resolve().is_relative_to(p) and not m.issym() and not m.islnk()
 t.extractall(p,filter='data')
v=json.loads((p/'payload.json').read_text());assert v['source']=='a14f0320aeed077fbf449c95f2b236f4dd1d3393' and sha(p/'app.jar')==v['coreJarSha256'];tag='bobuy/core:20261112.reference-sort'
with (p/'build.log').open('w') as f:r=subprocess.run(['docker','build','--network=none','--label','org.opencontainers.image.revision='+v['source'],'-t',tag,'-f',str(p/'Dockerfile.core'),str(p)],stdout=f,stderr=subprocess.STDOUT,timeout=180);assert r.returncode==0
d=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0];old=json.loads(Path('/opt/bobuy/releases/20261112.reference-display.4/artifact.json').read_text());a=dict(source=v['source'],release=v['release'],coreJarSha256=v['coreJarSha256'],images=[dict(name='core-service',tag=tag,imageId=d['Id'])],frontend=old['frontend'],frontendSource=old['source']);(p/'artifact.staged.json').write_text(json.dumps(a,indent=2));print(json.dumps(dict(source=a['source'],imageId=d['Id'])))
