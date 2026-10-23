"""Exercise V5 upgrade, invalid role sets and snapshot rollback in the existing local PostgreSQL."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DB = 'bobuy_plan61_migration'
EXEC = ['docker', 'compose', '-p', 'bobuy-local', '-f', str(ROOT / 'compose.local.yml'),
        'exec', '-T', 'postgres']


def sql(text, check=True):
    return subprocess.run(EXEC + ['psql', '-U', 'bobuy', '-d', DB, '-v', 'ON_ERROR_STOP=1', '-At'],
                          input=text, text=True, capture_output=True, check=check)


def main():
    subprocess.run(EXEC + ['createdb', '-U', 'bobuy', DB], check=True, capture_output=True)
    report = {}
    try:
        sql("""CREATE TABLE bb_user (id bigint primary key, username text unique, role text,
               password_hash text, email_verified_at timestamptz);
               INSERT INTO bb_user VALUES (1,'admin','AGENT','preserved-hash',now()),
               (2,'customer','CUSTOMER','customer-hash',null),(3,'supplier','MERCHANT','supplier-hash',null);
               CREATE TABLE sample_orders (id bigint primary key, customer_id bigint references bb_user);
               INSERT INTO sample_orders VALUES (1,2);""")
        snapshot = subprocess.check_output(EXEC + ['pg_dump', '-U', 'bobuy', '-d', DB, '-Fc'])
        migration = (ROOT / 'backend/src/main/resources/db/migration/V5__user_role_sets.sql').read_text()
        sql('BEGIN;\n' + migration + '\nCOMMIT;')
        assert sql("select string_agg(username || ':' || roles::text || ':' || platform_admin, ',' order by id) from bb_user;").stdout.strip() == 'admin:["AGENT"]:true,customer:["CUSTOMER"]:false,supplier:["AGENT"]:false'
        assert sql("select password_hash from bb_user where id=1;").stdout.strip() == 'preserved-hash'
        assert sql('select count(*) from sample_orders where customer_id=2;').stdout.strip() == '1'
        for invalid in ['[]', '["UNKNOWN"]', '["CUSTOMER","CUSTOMER"]', '{}', 'null']:
            result = sql("update bb_user set roles='" + invalid + "'::jsonb where id=2;", check=False)
            assert result.returncode != 0, invalid
        report['upgradePreservesAccountsPasswordsOrders'] = 'PASS'
        report['invalidRoleSetsRejected'] = 'PASS'
        subprocess.run(EXEC + ['pg_restore', '-U', 'bobuy', '-d', DB, '--clean', '--if-exists', '--exit-on-error'],
                       input=snapshot, check=True, capture_output=True)
        assert sql("select role || ':' || password_hash from bb_user where id=1;").stdout.strip() == 'AGENT:preserved-hash'
        assert sql("select count(*) from information_schema.columns where table_name='bb_user' and column_name='roles';").stdout.strip() == '0'
        assert sql('select count(*) from sample_orders;').stdout.strip() == '1'
        report['snapshotRollbackRestoresOldSchemaAndData'] = 'PASS'
        report['result'] = 'PASS'
    finally:
        subprocess.run(EXEC + ['dropdb', '-U', 'bobuy', DB], check=True, capture_output=True)
        report['temporaryDatabaseRemoved'] = True
        output = ROOT / 'docs/reports/evidence/PLAN61/local/migration-report.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2))
    print(json.dumps(report))


if __name__ == '__main__':
    main()
