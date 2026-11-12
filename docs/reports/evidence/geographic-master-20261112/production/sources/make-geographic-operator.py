"""Adapt the verified existing migration publisher; preserve its recovery guards."""
import hashlib,json,subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'docs/reports/evidence/geographic-master-20261112/production'
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
base=json.loads((E/'runtime-before.json').read_text(encoding='utf-8'))
original=(E/'accepted-release_operator.py').read_bytes()
assert hashlib.sha256(original).hexdigest()=='5fddec223ef6f1d38402c8a11c1f99877ffc93f9d7d4b5afeb1271752c5610ac'
template=original.decode('utf-8-sig').replace('\r\n','\n')
replacements={
 'SOURCE=\'eb43b4868fa214f8dc68feb39ab083bf7b3df42e\'':f'SOURCE={source!r}',
 "BASE='d77fe7759a22f64f311ddf575a7a4f647fe184ea'":"BASE="+repr(subprocess.check_output(['git','rev-parse','origin/main'],cwd=ROOT,text=True).strip()),
 'RELEASE=\'20261111.1\'':"RELEASE='20261112.geographic_master.1'",
 "BASE_REVISIONS={'core-service':'48433bd7c9bd60b1f77d46a572800d38d0ef0a7a','frontend':'a16af01e308521fa54e7c4df8d18e1567e5ec1fe'}":'BASE_REVISIONS='+repr({name:base['states']['bobuy-'+name]['revision'] for name in ('core-service','frontend')}),
 "set(value.get('migrationSha256',{}))!={'28.2','29','30','31','32'}":"set(value.get('migrationSha256',{}))!={'34'}",
 'All five reviewed migrations required':'Only the reviewed V34 migration is allowed',
 "g['frontendTests']!=750 or g['backendTests']!=644":"g['frontendTests']!=814 or g['frontendAffectedTests']!=6 or g['backendTests']!=674 or g['codeql']!='success'",
 "!='28.1'":"!='33'",
 'Expected production PG18.6/V28.1 changed':'Expected production PG18.6/V33 changed',
 "!='32'":"!='34'",
 'Flyway V32 not established':'Flyway V34 not established',
 'databaseVersion=32':'databaseVersion=34',
 "'schema':'V28.1 -> V28.2 -> V29 -> V30 -> V31 -> V32'":"'schema':'V33 -> V34'",
 "with (STAGE/'operator.lock').open('w') as lock:":"with (ROOT/'releases/engagement-global.lock').open('a+') as lock:",
}
for old,new in replacements.items():
    assert old in template,old
    template=template.replace(old,new)
needle="  if time.monotonic()-start>300:raise RuntimeError('Five-minute pre-open deadline exceeded')"
assert template.count(needle)==1
template=template.replace(needle,"  verify_geographic_reference(artifact)\n"+needle)
helper='''
def verify_geographic_reference(artifact):
 path=STAGE/'geographic-reference.json'
 if sha(path)!=artifact['referenceSha256']:raise RuntimeError('Reference source binding changed')
 expected=json.loads(path.read_text())
 actual=json.loads(sql("select json_agg(json_build_array(code,parent_code,level,name,reading) order by level,code) from bb_geographic_area"))
 if actual!=expected:raise RuntimeError('Geographic reference data differs from reviewed sources')
 if run('docker','exec','bobuy-core-service','sha256sum','/app/app.jar').split()[0]!=artifact['coreJarSha256']:raise RuntimeError('Loaded Core JAR differs')
 output=run('docker','exec','bobuy-frontend','sh','-c','cd /usr/share/nginx/html && find . -type f -exec sha256sum {} +')
 loaded={name.removeprefix('./'):digest for digest,name in (line.split(None,1) for line in output.splitlines())}
 if any(loaded.get(name)!=digest for name,digest in artifact['frontend'].items()):raise RuntimeError('Loaded frontend assets differ')
 countries=json.loads(run('docker','exec','bobuy-core-service','curl','-fsS','http://127.0.0.1:8081/api/storefront/geographic-areas'))['data']
 prefectures=json.loads(run('docker','exec','bobuy-core-service','curl','-fsS','http://127.0.0.1:8081/api/storefront/geographic-areas?parentCode=JP'))['data']
 empty=json.loads(run('docker','exec','bobuy-core-service','curl','-fsS','http://127.0.0.1:8081/api/storefront/geographic-areas?parentCode=US'))['data']
 if len(countries)!=249 or len(prefectures)!=47 or empty!=[]:raise RuntimeError('Geographic API acceptance failed')
 (STAGE/'geographic-acceptance.json').write_text(json.dumps(dict(result='PASS',rows=len(actual),countries=len(countries),prefectures=len(prefectures),otherCountryHasNoChildren=True)))

'''
assert template.count('def plan():')==1
template=template.replace('def plan():',helper+'def plan():')
(E/'geographic-operator.py').write_text(template,encoding='utf-8',newline='\n')
print(json.dumps({'source':source,'operatorSha256':hashlib.sha256(template.encode()).hexdigest(),'templateSha256':base['librarySha256']['release_operator.py']}))
