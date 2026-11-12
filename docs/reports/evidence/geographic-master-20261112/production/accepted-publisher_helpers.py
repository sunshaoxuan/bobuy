import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def validate_restored_database(expected, actual):
    if not expected or expected != actual:
        raise RuntimeError('Restored database differs from the stopped-writer snapshot')

def database_fingerprint(database=None):
    command = 'psql -U "$POSTGRES_USER" -d ' + (database or '"$POSTGRES_DB"') + ' -qAt -v ON_ERROR_STOP=1'

    def sql(query):
        return subprocess.check_output(['docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c', command], input=query, text=True).strip()
    tables = sql("select tablename from pg_tables where schemaname='public' order by tablename;").splitlines()
    if 'flyway_schema_history' not in tables:
        raise RuntimeError('Missing migration history in database snapshot')
    result = {}
    for table in tables:
        identifier = '"' + table.replace('"', '""') + '"'
        result[table] = sql("select count(*) || ':' || md5(coalesce(string_agg(v, chr(10) order by v), '')) from (select row_to_json(t)::text v from public." + identifier + ' t) rows;')
    result['columns'] = sql("select md5(string_agg(row_to_json(c)::text, ',' order by table_name, column_name)) from (select table_name, column_name, column_default, is_nullable, data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale from information_schema.columns where table_schema='public') c;")
    result['indexes'] = sql("select md5(string_agg(indexdef, ',' order by indexname)) from pg_indexes where schemaname='public';")
    constraints = json.loads(sql("select coalesce(json_agg(s), '[]'::json) from (select conrelid::regclass::text as relation, conname, contype, convalidated, condeferrable, condeferred, pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' order by conrelid::regclass::text, conname) s;"))
    for constraint in constraints:
        if constraint['contype'] == 'c':
            constraint['definition'] = sql('BEGIN; CREATE TEMP TABLE __bobuy_constraint_probe (LIKE ' + constraint['relation'] + '); ALTER TABLE __bobuy_constraint_probe ADD CONSTRAINT __probe ' + constraint['definition'] + "; SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='__bobuy_constraint_probe'::regclass AND conname='__probe'; ROLLBACK;")
    result['constraints'] = hashlib.sha256(json.dumps(constraints, sort_keys=True).encode()).hexdigest()
    result['sequences'] = sql("select md5(string_agg(sequencename || ':' || coalesce(last_value::text, 'null'), ',' order by sequencename)) from pg_sequences where schemaname='public';")
    return result

def maintenance_config(config):
    upstream = 'location /api {\n        proxy_pass http://gateway-service:8080;\n    }'
    if config.count(upstream) != 1:
        raise RuntimeError('Cannot establish the API write-freeze boundary')
    return config.replace(upstream, 'location /api {\n        default_type application/json;\n        return 503 \'{"message":"Release maintenance in progress"}\';\n    }')

def cleanup_added_tables_sql(snapshot):
    tables = sorted(set(snapshot) - {'columns', 'indexes', 'constraints', 'sequences'})
    if 'flyway_schema_history' not in tables or len(tables) < 2 or any((not re.fullmatch('[a-zA-Z_][a-zA-Z0-9_]*', name) for name in tables)):
        raise ValueError('Verified pre-upgrade table inventory is required for rollback')
    names = ','.join(("'" + name + "'" for name in tables))
    return "DO $cleanup$ DECLARE added record; BEGIN\n    FOR added IN SELECT tablename FROM pg_tables WHERE schemaname='public'\n      AND NOT (tablename=ANY(ARRAY[" + names + "]::text[]))\n    LOOP EXECUTE format('DROP TABLE public.%I CASCADE',added.tablename); END LOOP;\n    END $cleanup$;"

def restore_database(compose, dump, snapshot):
    added_table_cleanup = cleanup_added_tables_sql(snapshot)
    run(*compose, 'stop', 'core-service', 'ai-service', 'im-service', 'auth-service', 'gateway-service')
    run('docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -v ON_ERROR_STOP=1', input=DROP_FOREIGN_KEYS_SQL, text=True)
    run('docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -v ON_ERROR_STOP=1', input=added_table_cleanup, text=True)
    with dump.open('rb') as source:
        run('docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c', 'pg_restore --clean --if-exists --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"', stdin=source)
DROP_FOREIGN_KEYS_SQL = "\nDO $restore$\nDECLARE constraint_row record;\nBEGIN\n    FOR constraint_row IN\n        SELECT n.nspname, t.relname, c.conname FROM pg_constraint c\n        JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace\n        WHERE c.contype='f' AND n.nspname='public'\n    LOOP\n        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',\n            constraint_row.nspname, constraint_row.relname, constraint_row.conname);\n    END LOOP;\nEND $restore$;\n"
