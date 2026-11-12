from pathlib import Path
import json,hashlib,importlib.util
stage=Path('/opt/bobuy/releases/20261112.reference-display.4');assert stage.is_dir() and not stage.is_symlink()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
prior=json.loads(Path('/opt/bobuy/releases/20261112.5/status.json').read_text());assert prior['phase']=='WRITES_OPEN'
library=Path('/opt/bobuy/releases/20261111.1/release_operator.py');assert sha(library)=='5fddec223ef6f1d38402c8a11c1f99877ffc93f9d7d4b5afeb1271752c5610ac'
spec=importlib.util.spec_from_file_location('library',library);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
base={n:m.state(n) for n in (*m.WRITERS,'frontend',*m.PROTECTED)}
assert all(base[n]['revision']=='606deb375b125d41e451dad555bb306f70f0fae3' for n in ('core-service','frontend'))
assert all(v['health'] in ('healthy','running') for v in base.values())
assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='33'
g=json.loads((stage/'gates.json').read_text());assert g['source']=='deac521fdb5c10e4accc2d4cc368fb494ab61801' and g['result']=='PASS' and g['codeql']=='success'
a=json.loads((stage/'artifact.staged.json').read_text());assert a['source']==g['source'] and a['release']=='20261112.reference-display.4'
for i in a['images']:
 d=json.loads(m.run('docker','image','inspect',i['tag']))[0];assert d['Id']==i['imageId'] and d['Config']['Labels']['org.opencontainers.image.revision']==a['source']
assert json.loads((stage/'migration-binding.json').read_text())['result']=='PASS'
a.update(base=base,librarySha256=sha(library),helperSha256=sha(stage/'publisher_helpers.py'),operatorSha256=sha(stage/'release-operator.py'),gatesSha256=sha(stage/'gates.json'),migrationBindingSha256=sha(stage/'migration-binding.json'),sqlMigration=False)
assert not (stage/'artifact.json').exists();(stage/'artifact.json').write_text(json.dumps(a,indent=2));print(json.dumps(dict(source=a['source'],base={k:dict(tag=base[k]['tag'],revision=base[k]['revision'],image=base[k]['image']) for k in ('core-service','frontend')},images=[dict(name=i['name'],tag=i['tag'],imageId=i['imageId']) for i in a['images']])))
