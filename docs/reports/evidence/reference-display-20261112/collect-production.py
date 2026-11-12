from pathlib import Path
import json,importlib.util,subprocess
p=Path('/opt/bobuy/releases/20261112.reference-sort');a=json.loads((p/'artifact.json').read_text());before=json.loads((p/'runtime.before.json').read_text())
lib=Path('/opt/bobuy/releases/20261111.1/release_operator.py');spec=importlib.util.spec_from_file_location('release',lib);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
runtime={n:m.state(n) for n in (*m.WRITERS,'frontend',*m.PROTECTED)};assert all(v['health'] in ('healthy','running') for v in runtime.values());assert runtime['core-service']['image']==a['images'][0]['imageId'];assert runtime['frontend']==before['frontend'];assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='33';m.media_flags()
restarts={n:json.loads(subprocess.check_output(['docker','inspect','bobuy-'+n]))[0]['RestartCount'] for n in runtime};assert all(v==0 for v in restarts.values())
card=json.loads(m.run('docker','exec','bobuy-core-service','curl','-fsS','http://127.0.0.1:8081/api/storefront/product-browse?query=77839&locale=zh-CN'))['data']['items'][0];assert card['reference']['amount']==1498 and card['reference']['postId']==5
value=dict(result='PASS',schema=33,frontendUnchanged=True,source=a['source'],frontendSource=a['frontendSource'],runtime=runtime,restartCounts=restarts,referenceCard=dict(itemNumber=card['itemNumber'],reference=card['reference']),activation=json.loads((p/'status.json').read_text()))
print(json.dumps(value,indent=2))
