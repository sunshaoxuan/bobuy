from pathlib import Path
import hashlib,json,subprocess,tarfile
stage=Path('/opt/bobuy/releases/20261112.reference-display.4');assert stage.is_dir() and not stage.is_symlink()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(stage/'payload.tar')=='f74912fbe4e3690921d9eb22cb84910dff3c78af088e64b860242a70f474bf62'
with tarfile.open(stage/'payload.tar') as archive:
 for member in archive.getmembers():assert not member.issym() and not member.islnk() and (stage/member.name).resolve().is_relative_to(stage)
 archive.extractall(stage,filter='data')
payload=json.loads((stage/'payload.json').read_text());assert payload['source']=='deac521fdb5c10e4accc2d4cc368fb494ab61801'
for name,digest in payload['files'].items():assert sha(stage/name)==digest
images=[]
for service,part in [('core-service','core'),('frontend','frontend')]:
 tag='bobuy/'+part+':20261112.reference-display.4'
 with (stage/(part+'-build.log')).open('w') as log:
  p=subprocess.run(['docker','build','--network=none','--label','org.opencontainers.image.revision='+payload['source'],'-t',tag,'-f',str(stage/('Dockerfile.'+part)),str(stage)],stdout=log,stderr=subprocess.STDOUT,timeout=180);assert p.returncode==0
 value=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]
 images.append(dict(name=service,tag=tag,imageId=value['Id'],rootfsDiffIds=value['RootFS']['Layers']))
(stage/'artifact.staged.json').write_text(json.dumps(dict(source=payload['source'],release=payload['release'],images=images,coreJarSha256=sha(stage/'app.jar'),frontend={name.removeprefix('dist/'):value for name,value in payload['files'].items() if name.startswith('dist/')}),indent=2))
print(json.dumps(dict(source=payload['source'],images=images)))
