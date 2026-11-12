"""Verify the exact migration in a disposable database on the existing local PG.

No production access. The shared local database is read through pg_dump only.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/reports/evidence/geographic-master-20261112'
CONTAINER = 'bobuy-local-postgres-1'
PROBE = 'bobuy_geographic_v34_probe'

def run(*args, data=None, check=True):
    return subprocess.run(['docker','exec','-i',CONTAINER,*args],input=data,capture_output=True,check=check)

def sql(statement, check=True):
    return run('psql','-X','-U','bobuy','-d',PROBE,'-v','ON_ERROR_STOP=1','-Atq',data=statement.encode(),check=check)

def text(statement):
    return sql(statement).stdout.decode().strip()

started = time.monotonic()
migration = (ROOT / 'backend/src/main/resources/db/migration/V34__geographic_master.sql').read_bytes()
spec = importlib.util.spec_from_file_location('generator', ROOT / 'scripts/generate-geographic-master.py')
generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)
assert migration == generator.generate().encode(), 'Seed differs from pinned source extracts'
backup = run('pg_dump','-U','bobuy','-d','bobuy','-Fc','--no-owner','--no-privileges').stdout
created = False
try:
    run('createdb','-U','bobuy',PROBE); created=True
    run('pg_restore','-U','bobuy','-d',PROBE,'--no-owner','--no-privileges','--exit-on-error',data=backup)
    tables=text("select tablename from pg_tables where schemaname='public' order by tablename").splitlines()
    assert 'bb_geographic_area' not in tables, 'Probe base already has this migration'
    def fingerprint():
        return {name:text('select md5(coalesce(string_agg(to_jsonb(t)::text,E\'\\n\' order by to_jsonb(t)::text),\'\')) from public."'+name+'" t') for name in tables}
    before=fingerprint()
    sql(migration.decode())
    actual=json.loads(text("select json_agg(json_build_array(code,parent_code,level,name,reading) order by level,code) from bb_geographic_area"))
    assert actual == [list(row) for row in generator.rows()]
    assert fingerprint()==before,'Migration modified existing rows'
    sql(migration.decode())
    assert text('select count(*) from bb_geographic_area')=='2208'
    assert text("select count(*) from bb_geographic_area where level>1 and code not like 'JP-%'")=='0'
    assert text('select count(distinct parent_code) from bb_geographic_area where level=3')=='47'
    invalid=[
        "('JP-99999','JP-99',3,'orphan')",
        "('JP-13999','JP-01',3,'wrong prefecture')",
        "('JP-13999','JP',3,'wrong level')",
        "('JP-99',NULL,2,'missing parent')",
        "('ZZ',NULL,1,'  ')",
        "('JP-99','JP-99',2,'self parent')",
        "('ZZ-00','US',2,'wrong country')",
    ]
    for value in invalid:
        failure=sql('INSERT INTO bb_geographic_area(code,parent_code,level,name) VALUES '+value,check=False)
        assert failure.returncode != 0 and b'violates' in failure.stderr, value
    assert text('select count(*) from bb_geographic_area')=='2208'
    sql('DROP TABLE bb_geographic_area;')
    assert fingerprint()==before,'Scoped schema rollback changed existing data'
    sql(migration.decode())
    assert fingerprint()==before
    result={'result':'PASS','scope':'Existing LOCAL PostgreSQL, isolated cloned disposable database; no production access',
        'postgresVersion':text('show server_version'),'migrationSha256':hashlib.sha256(migration).hexdigest(),
        'backupSha256':hashlib.sha256(backup).hexdigest(),'countries':249,'prefectures':47,'municipalitiesAndWards':1912,
        'all2208RowsMatchPinnedSources':True,'japanPost1892CodesCovered':True,'originalTablesPreserved':len(tables),
        'secondApplicationIdempotent':True,'negativeConstraintCasesRejected':len(invalid),
        'scopedDropAndReapplyPreserveExistingRows':True,'elapsedSeconds':round(time.monotonic()-started,2)}
finally:
    if created: run('dropdb','-U','bobuy',PROBE)
result['temporaryDatabaseRemoved']=True
(OUT/'migration.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
