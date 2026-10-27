"""Restore and verify additive V20 in an isolated database of the EXISTING local PG instance."""
from pathlib import Path
import subprocess,json,hashlib,time

root=Path(__file__).resolve().parents[1]
container='bobuy-local-postgres-1';probe='bobuy_lifecycle_v20_probe'
out=root/'docs/reports/evidence/product-lifecycle';out.mkdir(parents=True,exist_ok=True)
private=root/'.task-tmp';private.mkdir(exist_ok=True)
def run(*args,input=None):
    p=subprocess.run(['docker','exec','-i',container,*args],input=input,capture_output=True)
    if p.returncode:raise RuntimeError(p.stderr.decode('utf-8',errors='replace'))
    return p.stdout
def sql(query,database=probe):
    return run('psql','-X','-U','bobuy','-d',database,'-qAt','-v','ON_ERROR_STOP=1',input=query.encode()).decode().strip()
assert sql("select count(*) from pg_database where datname='"+probe+"'",'bobuy')=='0','Do not reuse or overwrite an existing probe'
assert sql("select count(*) from pg_stat_activity where datname='bobuy' and state='active' and pid<>pg_backend_pid()",'bobuy')=='0','Shared local database is busy'
start=time.monotonic();backup=run('pg_dump','-U','bobuy','-d','bobuy','-Fc','--no-owner','--no-privileges')
(private/'before-product-lifecycle-v20.dump').write_bytes(backup)
created=False
try:
    run('createdb','-U','bobuy',probe);created=True
    run('pg_restore','-U','bobuy','-d',probe,'--no-owner','--no-privileges','--exit-on-error',input=backup)
    tables=sql("select tablename from pg_tables where schemaname='public' order by tablename").splitlines()
    assert 'bb_product_lifecycle_event' not in tables,'V20 already applied; a fresh legacy rehearsal is required'
    def fingerprint():
        return {name:sql("select json_build_object('count',count(*),'hash',md5(coalesce(string_agg((to_jsonb(t)-'deleted_at'-'deleted_by')::text,E'\\n' order by (to_jsonb(t)-'deleted_at'-'deleted_by')::text),''))) from public.\""+name+'\" t') for name in tables}
    before=fingerprint();migration=(root/'backend/src/main/resources/db/migration/V20__product_logical_deletion.sql').read_bytes()
    sql(migration.decode());assert fingerprint()==before,'Migration modified existing content'
    assert sql('select count(*) from bb_product where deleted_at is not null or deleted_by is not null')=='0'
    assert sql('select count(*) from bb_product_lifecycle_event')=='0'
    assert sql("select count(*) from pg_indexes where schemaname='public' and indexname='bb_product_deleted_at'")=='1'
    # Only this newly-created disposable probe schema is cleared for actual restore verification.
    assert probe=='bobuy_lifecycle_v20_probe'
    sql('DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION bobuy;')
    run('pg_restore','-U','bobuy','-d',probe,'--no-owner','--no-privileges','--exit-on-error',input=backup)
    assert fingerprint()==before,'Restored legacy rows differ'
    assert sql("select count(*) from information_schema.columns where table_schema='public' and table_name='bb_product' and column_name='deleted_at'")=='0'
    result={'result':'PASS','scope':'Existing shared LOCAL PostgreSQL; isolated temporary database only; no production backup or data',
       'postgresVersion':sql('show server_version'),'tablesPreserved':len(tables),'backupSha256':hashlib.sha256(backup).hexdigest(),
       'migrationSha256':hashlib.sha256(migration).hexdigest(),'allOriginalRowsAndImageBytesUnchanged':True,
       'newDeletionFieldsNullAndAuditEmpty':True,'actualLegacyBackupRestoreMatches':True,'elapsedSeconds':round(time.monotonic()-start,2)}
finally:
    if created:run('dropdb','-U','bobuy',probe)
result['temporaryDatabaseRemoved']=True
(out/'migration-restore.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
