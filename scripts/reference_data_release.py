"""Apply reviewed additive reference SQL without backup, service changes or write freeze.

Plans and their SQL are trusted, reviewed release inputs, not untrusted uploads.
Hashes bind that review; this module does not infer SQL safety from its spelling.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess


def digest(data):
    return hashlib.sha256(data).hexdigest()


def bound_file(stage, entry):
    if not isinstance(entry, dict) or not isinstance(entry.get('path'), str):
        raise ValueError('Missing bound input')
    path = (stage / entry['path']).resolve()
    if not path.is_relative_to(stage.resolve()) or not path.is_file():
        raise ValueError('Release input must be a file inside its stage')
    data = path.read_bytes()
    if entry.get('sha256') != digest(data):
        raise ValueError('Reviewed release input changed')
    return data


def load_plan(stage, plan_path, expected_sha256):
    stage = Path(stage).resolve()
    plan_path = Path(plan_path).resolve()
    if not plan_path.is_relative_to(stage):
        raise ValueError('Reference plan must be inside the release stage')
    raw = plan_path.read_bytes()
    if not re.fullmatch(r'[a-f0-9]{64}', expected_sha256 or '') or digest(raw) != expected_sha256:
        raise ValueError('Reference plan differs from the reviewed hash')
    plan = json.loads(raw)
    required = {'kind', 'source', 'scope', 'sql', 'checks', 'acceptance', 'offsiteBackup'}
    if set(plan) != required or plan['kind'] != 'ADDITIVE_REFERENCE_DATA':
        raise ValueError('Explicit additive reference plan required')
    if not re.fullmatch(r'[a-f0-9]{40}', plan['source']):
        raise ValueError('Exact accepted source revision required')
    scope = plan['scope']
    if (set(scope) != {'tables', 'existingBusinessDataUnchanged', 'oldApplicationCompatible'}
            or scope['existingBusinessDataUnchanged'] is not True
            or scope['oldApplicationCompatible'] is not True
            or not scope['tables'] or len(set(scope['tables'])) != len(scope['tables'])
            or any(not re.fullmatch(r'bb_[a-z][a-z0-9_]*', table) for table in scope['tables'])
            or 'bb_user' in scope['tables'] or 'flyway_schema_history' in scope['tables']):
        raise ValueError('Reviewed reference-only scope and old-application compatibility required')
    acceptance = json.loads(bound_file(stage, plan['acceptance']))
    if (acceptance.get('source') != plan['source'] or acceptance.get('result') != 'PASS'
            or acceptance.get('referenceData') != {
                'idempotence': 'PASS', 'oldApplicationCompatibility': 'PASS',
                'businessDataPreservation': 'PASS'}
            or acceptance.get('sql') != plan['sql'] or acceptance.get('checks') != plan['checks']
            or acceptance.get('scope') != scope):
        raise ValueError('Acceptance must bind exact source, scope, SQL and focused checks')
    backup = plan['offsiteBackup']
    if (set(backup) != {'status', 'recoveryLocation', 'evidence'}
            or backup['status'] not in ('VERIFIED', 'UNKNOWN')):
        raise ValueError('Record existing offsite recovery status explicitly')
    if backup['status'] == 'VERIFIED':
        if not isinstance(backup['recoveryLocation'], str) or not backup['recoveryLocation'].strip():
            raise ValueError('Verified backup requires its recovery location')
        bound_file(stage, backup['evidence'])
    elif backup['evidence'] is not None or backup['recoveryLocation'] is not None:
        raise ValueError('Unknown backup coverage must not imply verified evidence')
    if not isinstance(plan['sql'], list) or not plan['sql']:
        raise ValueError('Missing idempotent SQL')
    scripts = [bound_file(stage, entry).decode('utf-8-sig') for entry in plan['sql']]
    if not isinstance(plan['checks'], list) or not plan['checks']:
        raise ValueError('Focused reference checks required')
    checks = []
    covered = set()
    for entry in plan['checks']:
        if (set(entry) != {'path', 'sha256', 'table', 'expected'}
                or entry['table'] not in scope['tables'] or not isinstance(entry['expected'], str)):
            raise ValueError('Each check must bind a scoped table and scalar expected value')
        query = bound_file(stage, entry).decode('utf-8-sig').strip().rstrip(';').strip()
        if not re.match(r'^SELECT\s', query, re.I):
            raise ValueError('Focused checks must be reviewed scalar SELECT queries')
        checks.append((query, entry['expected']))
        covered.add(entry['table'])
    if covered != set(scope['tables']):
        raise ValueError('Every reference table needs a focused check')
    return plan, scripts, checks


def transaction_sql(scripts, checks):
    # Reviewed SQL must not contain transaction control, psql commands, session
    # settings or business mutations. Those are review requirements, not a SQL parser.
    parts = ["BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='120s';"]
    parts.extend(scripts)
    for query, expected in checks:
        literal = "'" + expected.replace("'", "''") + "'"
        body = ('BEGIN IF (' + query + ')::text IS DISTINCT FROM ' + literal
                + " THEN RAISE EXCEPTION 'Reference data acceptance mismatch'; END IF; END;")
        parts.append('DO ' + "'" + body.replace("'", "''") + "';")
    parts.append('COMMIT;')
    return '\n'.join(parts) + '\n'


def run_sql(statement):
    # The only production command in this path. No compose, dump, restore,
    # maintenance nginx or application replacement is performed.
    subprocess.run(['docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c',
                    'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt -v ON_ERROR_STOP=1'],
                   input=statement.encode('utf-8'), check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def execute_reference_import(stage, plan_path, plan_sha256):
    stage = Path(stage).resolve()
    plan, scripts, checks = load_plan(stage, plan_path, plan_sha256)
    receipt = stage / 'reference-data-result.json'
    result = {'status': 'IMPORTING', 'source': plan['source'], 'planSha256': plan_sha256,
              'tables': plan['scope']['tables'], 'offsiteBackup': plan['offsiteBackup'],
              'fullSnapshot': False, 'globalWriteFreeze': False, 'applicationServicesChanged': False,
              'databaseRestore': False, 'applicationAndBrowserAcceptance': 'SEPARATE_REQUIRED_IF_CHANGED'}
    # An uncertain prior commit requires inspection, never an implicit replay.
    with receipt.open('x', encoding='utf-8') as output:
        json.dump(result, output, indent=2)
    try:
        run_sql(transaction_sql(scripts, checks))
        result['status'] = 'REFERENCE_IMPORT_VERIFIED'
    except Exception:
        result['status'] = 'INSPECT_REQUIRED'
        receipt.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
        raise RuntimeError('Reference import failed or outcome is uncertain; inspect receipt and database, no automatic restore') from None
    receipt.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result
