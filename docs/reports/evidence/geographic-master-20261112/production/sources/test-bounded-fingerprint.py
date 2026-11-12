import importlib.util,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
file=root/'docs/reports/evidence/geographic-master-20261112/production/bounded-fingerprint.py'
spec=importlib.util.spec_from_file_location('bounded',file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
command=['docker','exec','-i','bobuy-local-postgres-1','psql','-X','-U','bobuy','-d','bobuy','-Atq','-v','ON_ERROR_STOP=1']
queries=[
 "select row_to_json(t)::text v from (select 1 id,'日本'::text label) t order by v",
 "select row_to_json(t)::text v from (values (1,E'line\\nback\\\\slash'),(2,NULL),(3,'日本'),(3,'日本')) t(id,label) order by v",
 "select row_to_json(t)::text v from (select 1 id where false) t order by v",
 "select row_to_json(t)::text v from (select n id,repeat('日本',1000) label from generate_series(1,1000) n) t order by v",
]
results=[]
for query in queries:
    expected=subprocess.check_output(command,input=("select count(*)||':'||md5(coalesce(string_agg(v,chr(10) order by v),'')) from ("+query+") rows;\n").encode()).decode().strip()
    actual=module.scan(command,query);assert actual==expected
    results.append({'legacy':expected,'stream':actual,'equal':True})
assert module.scan(command,queries[0])!=module.scan(command,queries[0].replace("'日本'","'変更'"))
out=root/'docs/reports/evidence/geographic-master-20261112/production/bounded-fingerprint-tests.json'
out.write_text(json.dumps({'result':'PASS','realDatabase':'Existing LOCAL PostgreSQL, read-only VALUES/generated rows only','legacyCompatibleCases':results,'changedDataNegativeRejected':True,'maxClientChunkBytes':1024*1024},indent=2)+'\n',encoding='utf-8')
print('PASS: four real PostgreSQL legacy/streaming equivalence cases and changed-data rejection.')
