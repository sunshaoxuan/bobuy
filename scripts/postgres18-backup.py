"""Online consistent Bobuy backup; produces private dump/globals and non-content checksums.

Does not switch servers, stop writers, modify source rows or repair migration history.
Run only on the authorized source host; never print dump/globals contents.
"""
import argparse
from datetime import datetime,timezone
import hashlib,json,os,re,subprocess,time
from pathlib import Path

def identifier(value):return '"'+value.replace('"','""')+'"'

def fingerprint(sql):
    tables=sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").splitlines()
    if 'flyway_schema_history' not in tables:raise RuntimeError('Source migration inventory missing')
    rows={}
    for table in tables:
        rows[table]=sql("SELECT count(*)||':'||md5(coalesce(string_agg(v,chr(10) ORDER BY v),'')) FROM "
            "(SELECT to_jsonb(t)::text v FROM public."+identifier(table)+" t) x")
    def records(query):return json.loads(sql("SELECT coalesce(json_agg(t),'[]'::json) FROM ("+query+") t"))
    columns=records("SELECT table_name,column_name,column_default,is_nullable,data_type,udt_name,character_maximum_length,numeric_precision,numeric_scale,is_identity,identity_generation,identity_start,identity_increment FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name")
    indexes=records("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")
    constraints=records("SELECT conrelid::regclass::text AS relation,conname,contype,convalidated,condeferrable,condeferred,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND contype<>'n' ORDER BY conrelid::regclass::text,conname")
    sequences=[]
    for name in sql("SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename").splitlines():
        sequences.append({'name':name,'state':sql('SELECT last_value::text||\':\'||is_called::text FROM public.'+identifier(name))})
    owners=records("SELECT tablename,tableowner FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    privileges=records("SELECT table_name,grantor,grantee,privilege_type,is_grantable FROM information_schema.table_privileges WHERE table_schema='public' ORDER BY table_name,grantor,grantee,privilege_type")
    roles=records("SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolconnlimit,rolbypassrls FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY rolname")
    memberships=records("SELECT parent.rolname AS role,member.rolname AS member,am.admin_option FROM pg_auth_members am JOIN pg_roles parent ON parent.oid=am.roleid JOIN pg_roles member ON member.oid=am.member WHERE member.rolname !~ '^pg_' ORDER BY parent.rolname,member.rolname")
    extensions=records("SELECT extname,extversion FROM pg_extension ORDER BY extname")
    locale=records("SELECT datcollate,datctype,datlocprovider,datcollversion FROM pg_database WHERE datname=current_database()")
    sortProbe=sql("SELECT string_agg(v,',' ORDER BY v) FROM unnest(ARRAY['a','Z','Ａ','中','日','あ','ア','é','e','2','10']) v")
    return dict(rows=rows,columns=columns,indexes=indexes,constraints=constraints,sequences=sequences,owners=owners,privileges=privileges,roles=roles,memberships=memberships,extensions=extensions,locale=locale,sortProbe=sortProbe)

def base_command(container,database=None):
    if not re.fullmatch(r'bobuy(?:-local)?-postgres(?:-1)?',container):raise ValueError('Only existing Bobuy PostgreSQL services are allowed')
    databaseArg='"$POSTGRES_DB"' if database is None else identifier(database)
    # Explicit database names use a safe restricted alphabet before entering shell syntax.
    if database is not None and not re.fullmatch(r'[a-zA-Z0-9_]+',database):raise ValueError('Invalid database name')
    if database is not None:databaseArg=database
    return ['docker','exec','-i',container,'sh','-c','psql -X -U "$POSTGRES_USER" -d '+databaseArg+' -qAt -v ON_ERROR_STOP=1']

def verify_fingerprint(expected,actual,parse_check):
    """Compare exact data/metadata; PostgreSQL itself canonicalizes cross-major CHECK syntax.

    parse_check(relation, definition) must use a rolled-back empty temporary table on
    the target. Never strip casts/text to make a changed predicate appear equal.
    """
    if not expected or set(expected)!=set(actual):raise RuntimeError('Missing fingerprint fields')
    differences=[key for key in expected if key!='constraints' and expected[key]!=actual[key]]
    if differences:raise RuntimeError('Restore differs in '+','.join(differences))
    key=lambda c:(c['relation'],c['conname'])
    old={key(c):c for c in expected['constraints']};new={key(c):c for c in actual['constraints']}
    if len(old)!=len(expected['constraints']) or len(new)!=len(actual['constraints']) or set(old)!=set(new):
        raise RuntimeError('Constraint inventory changed')
    canonical=[]
    for name,before in old.items():
        after=new[name]
        if before==after:continue
        if before['contype']!='c' or {k:v for k,v in before.items() if k!='definition'}!={k:v for k,v in after.items() if k!='definition'}:
            raise RuntimeError('Constraint metadata changed: '+str(name))
        if parse_check(before['relation'],before['definition'])!=after['definition']:
            raise RuntimeError('Constraint predicate changed: '+str(name))
        canonical.append({'relation':name[0],'constraint':name[1]})
    return {'allDataAndMetadata':'PASS','constraintInventoryAndSemantics':'PASS','targetParsedCanonicalizations':canonical}

def backup(container,output):
    os.umask(0o077);output.mkdir(parents=True,exist_ok=False)
    started=time.monotonic();command=base_command(container)
    keeper=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8')
    snapshot=None
    try:
        keeper.stdin.write('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();\n');keeper.stdin.flush()
        snapshot=keeper.stdout.readline().strip()
        if not re.fullmatch(r'[0-9A-Fa-f-]+',snapshot):raise RuntimeError('Snapshot export failed')
        def sql(query):
            text="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT '"+snapshot+"'; "+query+'; ROLLBACK;'
            return subprocess.check_output(command,input=text,text=True,encoding='utf-8').strip()
        sourceVersion=sql('SHOW server_version')
        with (output/'database.dump').open('wb') as stream:
            subprocess.run(['docker','exec',container,'sh','-c','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --snapshot='+snapshot],stdout=stream,check=True)
        state=fingerprint(sql)
        (output/'fingerprint.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        with (output/'globals.sql').open('wb') as stream:
            subprocess.run(['docker','exec',container,'sh','-c','pg_dumpall -U "$POSTGRES_USER" --globals-only'],stdout=stream,check=True)
        manifest={'createdAt':datetime.now(timezone.utc).isoformat(),'sourceVersion':sourceVersion,'consistentExportedSnapshot':True,
            'tableCount':len(state['rows']),'roles':[r['rolname'] for r in state['roles']],
            'elapsedSeconds':round(time.monotonic()-started,2),'files':{}}
        for name in ['database.dump','globals.sql','fingerprint.json']:
            path=output/name;manifest['files'][name]={'bytes':path.stat().st_size,'sha256':hashlib.file_digest(path.open('rb'),'sha256').hexdigest()}
        (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
        return manifest
    finally:
        if snapshot:
            keeper.stdin.write('ROLLBACK;\n');keeper.stdin.flush()
        keeper.stdin.close();keeper.wait(timeout=20)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--container',required=True);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();print(json.dumps(backup(args.container,args.output)))
