"""C2 populated V27->V28 preservation gate. Existing hosted CI PostgreSQL service only."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

URL = 'jdbc:postgresql://127.0.0.1:5432/bobbuy'
ROOT = Path(__file__).resolve().parents[1]
ADDED = {'delivery_snapshot', 'checkout_payload_hash'}


def require_isolated_ci(env):
    if (env.get('GITHUB_ACTIONS'), env.get('GITHUB_EVENT_NAME'), env.get('GITHUB_JOB'),
            env.get('BOBBUY_ISOLATED_CI_POSTGRES')) != ('true', 'workflow_dispatch', 'postgres-migration-verify', 'true'):
        raise RuntimeError('Only the existing explicitly selected hosted CI PostgreSQL service may run this destructive test gate')


def command(args, *, input=None, env=None):
    value = subprocess.run(args, input=input, env=env, text=True, capture_output=True, cwd=ROOT, timeout=240)
    if value.returncode:
        raise RuntimeError('Isolated CI command failed: ' + args[0] + '\n' + value.stdout[-4000:] + '\n' + value.stderr[-2000:])
    return value.stdout.strip()


def sql(statement):
    env = dict(os.environ, PGPASSWORD='bobbuypassword', PGCONNECT_TIMEOUT='10')  # Existing ephemeral service test identity.
    return command(['psql', '-h', '127.0.0.1', '-p', '5432', '-U', 'bobbuy', '-d', 'bobbuy', '-X', '-qAt',
                    '-v', 'ON_ERROR_STOP=1'], input=statement, env=env)


def migrate(target, clean=False):
    args = ['mvn', '-B', '--file', 'backend/pom.xml', '-Dflyway.url=' + URL,
            '-Dflyway.user=bobbuy', '-Dflyway.password=bobbuypassword', '-Dflyway.target=' + str(target)]
    if clean:
        args += ['-Dflyway.cleanDisabled=false', 'flyway:clean']
    args += ['flyway:migrate', 'flyway:validate']
    command(args)


def columns():
    return json.loads(sql("SELECT coalesce(json_agg(x ORDER BY table_name,ordinal_position),'[]') FROM "
                          "(SELECT table_name,column_name,ordinal_position,data_type,udt_name,character_maximum_length,is_nullable,column_default "
                          "FROM information_schema.columns WHERE table_schema='public' AND table_name<>'flyway_schema_history') x;"))


def fingerprints(shape):
    grouped = {}
    for column in shape:
        grouped.setdefault(column['table_name'], []).append(column['column_name'])
    result = {}
    for table, names in sorted(grouped.items()):
        if any(not re.fullmatch('[a-z0-9_]+', name) for name in [table, *names]):
            raise RuntimeError('Unexpected test identifier')
        projection = ','.join('"' + name + '"' for name in names)
        query = 'SELECT count(*)::text||\':\'||md5(coalesce(string_agg(row_data,\'\' ORDER BY row_data),\'\')) FROM ' \
                '(SELECT row_to_json(r)::text row_data FROM (SELECT ' + projection + ' FROM "' + table + '") r) s;'
        result[table] = sql('BEGIN READ ONLY; ' + query + ' ROLLBACK;')
    return result


def assert_preserved(before_columns, after_columns, before_rows, after_rows):
    added = [x for x in after_columns if x not in before_columns]
    types = {x['column_name']: (x['data_type'], x['udt_name'], x['character_maximum_length']) for x in added}
    if ([x for x in after_columns if x in before_columns] != before_columns or len(added) != 2
            or {x['column_name'] for x in added} != ADDED
            or any(x['table_name'] != 'bb_order_header' or x['is_nullable'] != 'YES' or x['column_default'] is not None for x in added)
            or types != {'delivery_snapshot': ('jsonb', 'jsonb', None), 'checkout_payload_hash': ('character varying', 'varchar', 64)}
            or before_rows != after_rows):
        raise RuntimeError('V28 changed historical schema/data or its additive nullable-column contract')


def main():
    require_isolated_ci(os.environ)  # Must run before clean, seed or any database connection.
    migrate(27, clean=True)
    sql("INSERT INTO bb_order_header(id,business_id,status,payment_status,delivery_status,total_amount,currency,lines,product_identities) "
        "VALUES(-280001,'C2-CI-V27-HISTORICAL','NEW','UNPAID','PENDING_DELIVERY',123.5,'JPY',"
        "'[{\"id\":-280002,\"skuId\":\"c2-ci-old\",\"itemName\":\"Synthetic historical\",\"spec\":\"pack\",\"quantity\":2,\"unitPrice\":61.75}]'::jsonb,"
        "'{\"-280002\":{\"itemNumber\":\"C2-CI-OLD-ITEM\"}}'::jsonb);")
    before_columns = columns()
    before_rows = fingerprints(before_columns)
    assert len(before_rows) == 38 and before_rows['bb_order_header'].startswith('1:')
    migrate(28)
    after_columns = columns()
    after_rows = fingerprints(before_columns)  # Exact old projection, including raw lines and identity JSON.
    assert_preserved(before_columns, after_columns, before_rows, after_rows)
    nulls = sql('SELECT count(*) FROM bb_order_header WHERE id=-280001 AND delivery_snapshot IS NULL AND checkout_payload_hash IS NULL;')
    history = json.loads(sql("SELECT json_agg(x ORDER BY installed_rank) FROM (SELECT installed_rank,version,script,success FROM flyway_schema_history ORDER BY installed_rank) x;"))
    assert nulls == '1' and history[-1]['version'] == '28' and all(x['success'] for x in history)
    report = {'scope': 'EXISTING_EPHEMERAL_HOSTED_CI_POSTGRES_ONLY', 'status': 'PASS', 'schemaBefore': 27,
              'schemaAfter': 28, 'businessTables': len(before_rows), 'syntheticHistoricalOrders': 1,
              'allOldColumnsAndValuesPreserved': True, 'newHistoricalColumnsNull': True,
              'beforeFingerprints': before_rows, 'afterFingerprints': after_rows, 'migrationHistory': history,
              'noDatabaseRestore': True, 'businessDatasourceUsed': False}
    output = ROOT / 'backend/target/c2-upgrade-preservation.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in {'beforeFingerprints', 'afterFingerprints', 'migrationHistory'}}))


if __name__ == '__main__':
    main()
