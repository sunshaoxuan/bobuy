from pathlib import Path
import importlib.util,json
ROOT=Path(__file__).resolve().parents[4];OUT=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('prior',ROOT/'docs/reports/evidence/product-introductions-20261112/release-client.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
code='''import importlib.util,json
s=importlib.util.spec_from_file_location('lib','/opt/bobuy/releases/20261111.1/release_operator.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
print(json.dumps(dict(frontend=m.state('frontend'),core=m.state('core-service'),schema=m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1'))))
'''
v=json.loads(m.remote(code));(OUT/'production-before.json').write_text(json.dumps(v,indent=2));print(json.dumps(v))
