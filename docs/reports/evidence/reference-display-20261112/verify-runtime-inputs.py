from pathlib import Path
import subprocess,zipfile,hashlib,json,io,importlib.util,zlib,re
stage=Path('/opt/bobuy/releases/20261112.reference-display.4');assert stage.is_dir() and not stage.is_symlink()
subprocess.run(['docker','cp','bobuy-core-service:/app/app.jar',str(stage/'baseline-app.jar')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def migrations(path):
 result={}
 def read(z):
  for name in z.namelist():
   if 'db/migration/' in name and name.endswith('.sql'):result[name.split('db/migration/')[-1]]=z.read(name)
   elif name.endswith('.jar') and 'bobbuy' in name:
    with zipfile.ZipFile(io.BytesIO(z.read(name))) as inner:read(inner)
 with zipfile.ZipFile(path) as z:read(z)
 assert len(result)>30
 return result
before=migrations(stage/'baseline-app.jar');after=migrations(stage/'app.jar');rawChanges={k:dict(before=hashlib.sha256(v).hexdigest(),after=hashlib.sha256(after[k]).hexdigest(),sameSqlLines=v.decode('utf-8-sig').splitlines()==after[k].decode('utf-8-sig').splitlines()) for k,v in before.items() if v!=after.get(k)}
assert all(v['sameSqlLines'] for v in rawChanges.values()),'SQL source changed'
def checksum(data):
 value=zlib.crc32(''.join(re.split(r'\r\n|\r|\n',data.decode('utf-8-sig'))).encode('utf-8'));return value if value<2**31 else value-2**32
library=Path('/opt/bobuy/releases/20261111.1/release_operator.py');spec=importlib.util.spec_from_file_location('lib',library);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
history={version:int(crc) for version,crc in (line.split('|') for line in m.sql('select version,checksum from flyway_schema_history where success and version is not null order by installed_rank').splitlines())}
checks=[]
for name,data in after.items():
 version=re.fullmatch(r'V([0-9_]+)__.*\.sql',name).group(1).replace('_','.')
 checks.append(dict(file=name,version=version,candidateChecksum=checksum(data),databaseChecksum=history.get(version)))
added=sorted(set(after)-set(before));ok=not added and all(v['candidateChecksum']==v['databaseChecksum'] for v in checks)
value=dict(existingMigrations=len(before),rawLineEndingDifferences=rawChanges,added=added,checks=checks,algorithm='Flyway 11.14.1 ChecksumCalculator CRC32 over BufferedReader lines; verified with actual dependency and SQL mutation negative',result='PASS' if ok else 'FAIL');(stage/'migration-binding.json').write_text(json.dumps(value,indent=2));print(json.dumps(dict(result=value['result'],checkedMigrations=len(checks),lineEndingOnlyDifferences=list(rawChanges))));assert ok
