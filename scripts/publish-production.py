"""Publish one staged Bobuy release on its existing production node only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import time


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def validate_restored_database(expected, actual):
    if not expected or expected != actual:
        raise RuntimeError('Restored database differs from the stopped-writer snapshot')


def database_fingerprint(database=None):
    command = 'psql -U "$POSTGRES_USER" -d ' + (database or '"$POSTGRES_DB"') + ' -qAt -v ON_ERROR_STOP=1'

    def sql(query):
        return subprocess.check_output(['docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c', command],
            input=query, text=True).strip()

    tables = sql("select tablename from pg_tables where schemaname='public' order by tablename;").splitlines()
    if 'flyway_schema_history' not in tables:
        raise RuntimeError('Missing migration history in database snapshot')
    result = {}
    for table in tables:
        identifier = '"' + table.replace('"', '""') + '"'
        result[table] = sql("select count(*) || ':' || md5(coalesce(string_agg(v, chr(10) order by v), '')) "
            'from (select row_to_json(t)::text v from public.' + identifier + ' t) rows;')
    result['columns'] = sql("select md5(string_agg(row_to_json(c)::text, ',' order by table_name, column_name)) "
        "from (select table_name, column_name, column_default, is_nullable, data_type, "
        "udt_name, character_maximum_length, numeric_precision, numeric_scale from information_schema.columns "
        "where table_schema='public') c;")
    result['indexes'] = sql("select md5(string_agg(indexdef, ',' order by indexname)) from pg_indexes where schemaname='public';")
    constraints = json.loads(sql("select coalesce(json_agg(s), '[]'::json) from (select conrelid::regclass::text as relation, "
        "conname, contype, convalidated, condeferrable, condeferred, pg_get_constraintdef(c.oid) as definition "
        "from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' "
        "order by conrelid::regclass::text, conname) s;"))
    for constraint in constraints:
        if constraint['contype'] == 'c':
            # Reparse through PostgreSQL, which canonicalizes restored array casts.
            constraint['definition'] = sql('BEGIN; CREATE TEMP TABLE __bobuy_constraint_probe (LIKE '
                + constraint['relation'] + '); ALTER TABLE __bobuy_constraint_probe ADD CONSTRAINT __probe '
                + constraint['definition'] + "; SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                "WHERE conrelid='__bobuy_constraint_probe'::regclass AND conname='__probe'; ROLLBACK;")
    result['constraints'] = hashlib.sha256(json.dumps(constraints, sort_keys=True).encode()).hexdigest()
    result['sequences'] = sql("select md5(string_agg(sequencename || ':' || coalesce(last_value::text, 'null'), ',' order by sequencename)) "
        "from pg_sequences where schemaname='public';")
    return result


def maintenance_config(config):
    upstream = 'location /api {\n        proxy_pass http://gateway-service:8080;\n    }'
    if config.count(upstream) != 1:
        raise RuntimeError('Cannot establish the API write-freeze boundary')
    return config.replace(upstream, 'location /api {\n        default_type application/json;\n        return 503 \'{"message":"Release maintenance in progress"}\';\n    }')


def restore_database(compose, dump):
    # All application writers stop before replacing the migrated database.
    run(*compose, 'stop', 'core-service', 'ai-service', 'im-service', 'auth-service', 'gateway-service')
    # A pre-upgrade dump does not know foreign keys introduced by an upgrade.
    # Remove dependency edges only while all writers are stopped; pg_restore
    # recreates the complete original constraints from the verified snapshot.
    run('docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c',
        'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -v ON_ERROR_STOP=1',
        input=DROP_FOREIGN_KEYS_SQL, text=True)
    with dump.open('rb') as source:
        run('docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c',
            'pg_restore --clean --if-exists --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"', stdin=source)


DROP_FOREIGN_KEYS_SQL = """
DO $restore$
DECLARE constraint_row record;
BEGIN
    FOR constraint_row IN
        SELECT n.nspname, t.relname, c.conname FROM pg_constraint c
        JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
        WHERE c.contype='f' AND n.nspname='public'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
            constraint_row.nspname, constraint_row.relname, constraint_row.conname);
    END LOOP;
END $restore$;
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('release')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9]{8}\.[1-9][0-9]*', args.release):
        raise ValueError('Invalid release tag')
    root = Path('/opt/bobuy')
    stage = root / 'releases' / args.release
    backup = stage / 'backup'
    if os.geteuid() != 0 or not (stage / 'images.tar').is_file():
        raise RuntimeError('Run as root with the staged image archive')
    if backup.exists():
        raise RuntimeError('Release already attempted; inspect its receipt before retrying')
    os.umask(0o077)
    backup.mkdir()
    compose = ['docker', 'compose', '--env-file', '/etc/bobuy.env', '-p', 'bobuy',
               '-f', str(root / 'docker-compose.yml'), '-f', str(root / 'compose.production.yml')]
    applications = ['core-service', 'ai-service', 'im-service', 'auth-service',
                    'gateway-service', 'frontend']
    old_env = Path('/etc/bobuy.env').read_text()
    if len(re.findall(r'^BOBUY_RELEASE=.*$', old_env, re.M)) != 1:
        raise RuntimeError('Release setting must occur exactly once')
    shutil.copyfile('/etc/bobuy.env', backup / 'production.env')
    for name in ['docker-compose.yml', 'compose.production.yml', 'infra/nginx/bobuy.conf']:
        target = backup / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / name, target)
    snapshot = root / 'scripts/protected-node-state.py'
    before = subprocess.check_output(['python3', str(snapshot)])
    (stage / 'protected-before.json').write_bytes(before)
    run('docker', 'load', '-i', str(stage / 'images.tar'))

    def healthy(container):
        for _ in range(90):
            status = subprocess.check_output(['docker', 'inspect', container,
                '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}'], text=True).strip()
            if status == 'healthy':
                return
            time.sleep(2)
        raise RuntimeError(container + ' health timeout')

    database_upgrade_started = False
    backup_verified = False
    try:
        final_config = (stage / 'bobuy.conf').read_text()
        (root / 'infra/nginx/bobuy.conf').write_text(maintenance_config(final_config))
        run('docker', 'exec', 'bobuy-gateway', 'nginx', '-t')
        run('docker', 'exec', 'bobuy-gateway', 'nginx', '-s', 'reload')
        run(*compose, 'stop', *applications[:-1])
        expected_database = database_fingerprint()
        with (backup / 'database.dump').open('wb') as output:
            run('docker', 'exec', 'bobuy-postgres', 'sh', '-c',
                'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc', stdout=output)
        with tarfile.open(backup / 'objects.tar.gz', 'w:gz') as archive:
            archive.add(root / 'data/minio', arcname='minio')
        database = 'bobuy_restore_' + args.release.replace('.', '_')
        run('docker', 'exec', 'bobuy-postgres', 'sh', '-c',
            'createdb -U "$POSTGRES_USER" ' + database)
        try:
            with (backup / 'database.dump').open('rb') as source:
                run('docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c',
                    'pg_restore --exit-on-error -U "$POSTGRES_USER" -d ' + database, stdin=source)
            validate_restored_database(expected_database, database_fingerprint(database))
        finally:
            run('docker', 'exec', 'bobuy-postgres', 'sh', '-c',
                'dropdb -U "$POSTGRES_USER" ' + database)
        (stage / 'backup-check.json').write_text(json.dumps({
            'databaseRestore': 'PASS', 'restoredMigrationHistoryAndSchema': 'PASS',
            'temporaryDatabaseRemoved': True, 'objectsArchive': 'objects.tar.gz'}))
        backup_verified = True
        Path('/etc/bobuy.env').write_text(re.sub(r'^BOBUY_RELEASE=.*$',
            'BOBUY_RELEASE=' + args.release, old_env, flags=re.M))
        run(*compose, 'config', '--quiet')
        database_upgrade_started = True
        run(*compose, 'up', '-d', '--no-deps', 'core-service')
        healthy('bobuy-core-service')
        run(*compose, 'up', '-d', '--no-deps', *applications[1:])
        for service in applications[1:-1]:
            healthy('bobuy-' + service)
        after = subprocess.check_output(['python3', str(snapshot)])
        (stage / 'protected-after.json').write_bytes(after)
        if json.loads(before) != json.loads(after):
            raise RuntimeError('Protected-node state changed; inspect without altering it')
        (stage / 'release-result.json').write_text(json.dumps({
            'release': args.release, 'applicationHealth': 'PASS', 'protectedState': 'PASS',
            'publicRegistration': 'CLOSED_PENDING_SMTP_ABUSE_RECOVERY',
            'browserVerification': 'PENDING'}))
        shutil.copyfile(stage / 'bobuy.conf', root / 'infra/nginx/bobuy.conf')
        run('docker', 'exec', 'bobuy-gateway', 'nginx', '-t')
        run('docker', 'exec', 'bobuy-gateway', 'nginx', '-s', 'reload')
        print('PASS: release activated; production browser verification still required')
    except Exception:
        if database_upgrade_started:
            if not backup_verified:
                raise RuntimeError('Refusing database rollback without a verified backup')
            restore_database(compose, backup / 'database.dump')
            validate_restored_database(expected_database, database_fingerprint())
        Path('/etc/bobuy.env').write_text(old_env)
        shutil.copyfile(backup / 'infra/nginx/bobuy.conf', root / 'infra/nginx/bobuy.conf')
        run(*compose, 'up', '-d', '--no-deps', *applications)
        for service in applications[:-1]:
            healthy('bobuy-' + service)
        run('docker', 'exec', 'bobuy-gateway', 'nginx', '-t')
        run('docker', 'exec', 'bobuy-gateway', 'nginx', '-s', 'reload')
        print('Rollback activated with the verified pre-upgrade database when migration started.')
        raise


if __name__ == '__main__':
    main()
