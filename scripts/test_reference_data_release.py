"""Release command-chain guards and optional real LOCAL PostgreSQL acceptance."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import reference_data_release as reference

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('reference_publisher', ROOT / 'scripts/publish-production.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)
TEMP = ROOT / '.task-tmp/reference-release-tests'


def prepare(stage, sql=None, query=None, expected='2', table='bb_reference_probe'):
    (stage / 'seed.sql').write_text(sql or (
        'CREATE TABLE IF NOT EXISTS bb_reference_probe(code text PRIMARY KEY, parent text);\n'
        "INSERT INTO bb_reference_probe VALUES ('JP',NULL),('JP-13','JP') ON CONFLICT DO NOTHING;"), encoding='utf-8')
    (stage / 'check.sql').write_text(query or 'SELECT count(*) FROM bb_reference_probe;', encoding='utf-8')
    def entry(name):
        return {'path': name, 'sha256': reference.digest((stage / name).read_bytes())}
    plan = {'kind': 'ADDITIVE_REFERENCE_DATA', 'source': 'a' * 40,
            'scope': {'tables': [table], 'existingBusinessDataUnchanged': True,
                      'oldApplicationCompatible': True},
            'sql': [entry('seed.sql')],
            'checks': [{**entry('check.sql'), 'table': table, 'expected': expected}],
            'offsiteBackup': {'status': 'UNKNOWN', 'recoveryLocation': None, 'evidence': None}}
    accepted = {key: copy.deepcopy(plan[key]) for key in ('source', 'scope', 'sql', 'checks')}
    accepted.update(result='PASS', referenceData={'idempotence': 'PASS',
        'oldApplicationCompatibility': 'PASS', 'businessDataPreservation': 'PASS'})
    (stage / 'accepted.json').write_text(json.dumps(accepted), encoding='utf-8')
    plan['acceptance'] = entry('accepted.json')
    path = stage / 'reference-data.json'
    path.write_text(json.dumps(plan), encoding='utf-8')
    return path, reference.digest(path.read_bytes()), plan


class ReferenceReleaseTest(unittest.TestCase):
    def setUp(self):
        TEMP.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=TEMP)
        self.addCleanup(self.temp.cleanup)
        self.stage = Path(self.temp.name)
        self.path, self.sha, self.plan = prepare(self.stage)

    def test_real_cli_default_and_incomplete_modes_have_no_side_effects(self):
        cases = [[], ['--mode', 'maintenance'], ['--mode', 'reference-data'],
                 ['--mode', 'maintenance', '--maintenance-reason', ' '],
                 ['--mode', 'maintenance', '--maintenance-reason', 'risk', '--plan', str(self.path)],
                 ['--mode', 'reference-data', '--plan', str(self.path), '--plan-sha256', self.sha,
                  '--maintenance-reason', 'risk']]
        for options in cases:
            with self.subTest(options=options):
                result = subprocess.run([sys.executable, str(ROOT / 'scripts/publish-production.py'),
                    '20261112.9', *options], capture_output=True, text=True)
                self.assertEqual(result.returncode, 2)
                self.assertIn('error:', result.stderr)

    def test_public_reference_entry_never_enters_heavy_publisher(self):
        with patch.object(reference, 'execute_reference_import') as execute, \
                patch.object(publisher, 'run', side_effect=AssertionError('heavy run')), \
                patch.object(publisher, 'database_fingerprint', side_effect=AssertionError('full scan')):
            publisher.main(['20261112.9', '--mode', 'reference-data', '--plan', str(self.path),
                            '--plan-sha256', self.sha])
        execute.assert_called_once()

    def test_explicit_maintenance_keeps_existing_root_and_staged_image_guards(self):
        with patch.object(publisher.os, 'geteuid', return_value=1, create=True), \
                patch.object(reference, 'execute_reference_import') as reference_import, \
                patch.object(publisher, 'run') as command:
            with self.assertRaisesRegex(RuntimeError, 'Run as root'):
                publisher.main(['20261112.9', '--mode', 'maintenance', '--maintenance-reason', 'reviewed incompatible schema'])
            reference_import.assert_not_called()
            command.assert_not_called()

    def test_success_command_chain_only_executes_transactional_psql(self):
        with patch.object(reference.subprocess, 'run') as command:
            result = reference.execute_reference_import(self.stage, self.path, self.sha)
        self.assertEqual(result['status'], 'REFERENCE_IMPORT_VERIFIED')
        self.assertFalse(result['fullSnapshot'])
        self.assertFalse(result['globalWriteFreeze'])
        command.assert_called_once()
        args = command.call_args.args[0]
        self.assertEqual(args[:5], ['docker', 'exec', '-i', 'bobuy-postgres', 'sh'])
        self.assertIn('psql -X', args[-1])
        text = command.call_args.kwargs['input'].decode()
        self.assertTrue(text.startswith('BEGIN;'))
        self.assertIn("lock_timeout='3s'", text)
        self.assertIn('Reference data acceptance mismatch', text)
        self.assertTrue(text.endswith('COMMIT;\n'))
        self.assertEqual(result['offsiteBackup']['status'], 'UNKNOWN')

    def test_failure_and_uncertain_commit_never_restore_or_retry(self):
        with patch.object(reference.subprocess, 'run', side_effect=OSError('connection lost')) as command:
            with self.assertRaisesRegex(RuntimeError, 'inspect receipt'):
                reference.execute_reference_import(self.stage, self.path, self.sha)
        command.assert_called_once()
        receipt = json.loads((self.stage / 'reference-data-result.json').read_text())
        self.assertEqual(receipt['status'], 'INSPECT_REQUIRED')
        self.assertFalse(receipt['databaseRestore'])
        with patch.object(reference.subprocess, 'run') as command:
            with self.assertRaises(FileExistsError):
                reference.execute_reference_import(self.stage, self.path, self.sha)
            command.assert_not_called()

    def test_rejects_modified_sql_checks_plan_and_acceptance_before_commands(self):
        for name in ('seed.sql', 'check.sql', 'accepted.json', 'reference-data.json'):
            with self.subTest(name=name):
                path, sha, _ = prepare(self.stage)
                target = self.stage / name
                target.write_bytes(target.read_bytes() + b' ')
                with patch.object(reference, 'run_sql') as command:
                    with self.assertRaises(ValueError):
                        reference.execute_reference_import(self.stage, path, sha)
                    command.assert_not_called()

    def test_rejects_nonreference_and_unaccepted_inputs(self):
        variants = []
        plan = copy.deepcopy(self.plan); plan['kind'] = 'BUSINESS_DATA_REWRITE'; variants.append(plan)
        for key in ('existingBusinessDataUnchanged', 'oldApplicationCompatible'):
            plan = copy.deepcopy(self.plan); plan['scope'][key] = False; variants.append(plan)
        plan = copy.deepcopy(self.plan); plan['checks'] = []; variants.append(plan)
        plan = copy.deepcopy(self.plan); plan['sql'][0]['path'] = '../outside.sql'; variants.append(plan)
        plan = copy.deepcopy(self.plan); plan['offsiteBackup']['status'] = 'ASSUMED'; variants.append(plan)
        plan = copy.deepcopy(self.plan); plan['scope']['tables'].append('bb_second'); variants.append(plan)
        plan = copy.deepcopy(self.plan); plan['source'] = 'b' * 40; variants.append(plan)
        for plan in variants:
            self.path.write_text(json.dumps(plan), encoding='utf-8')
            with self.subTest(plan=plan), patch.object(reference, 'run_sql') as command:
                with self.assertRaises(ValueError):
                    reference.execute_reference_import(self.stage, self.path, reference.digest(self.path.read_bytes()))
                command.assert_not_called()

    @unittest.skipUnless(shutil.which('pwsh'), 'PowerShell 7 unavailable')
    def test_old_window_blocks_before_remote_or_local_commands(self):
        for options in ([], ['-AllowFullSnapshot'], ['-MaintenanceReason', 'reason']):
            result = subprocess.run(['pwsh', '-NoProfile', '-File', str(ROOT / 'scripts/run-server-release-window.ps1'),
                                     '-Target', 'ssh', *options], capture_output=True, text=True, encoding='utf-8', errors='replace')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Full release window requires', result.stderr)
            self.assertNotIn('Release window inputs', result.stdout)


@unittest.skipUnless(os.environ.get('BOBUY_REFERENCE_LOCAL_PG') == '1', 'Explicit local PostgreSQL opt-in required')
class LocalPostgresReferenceTest(unittest.TestCase):
    def test_real_idempotent_import_atomic_failure_and_concurrent_business_writes(self):
        container = 'bobuy-local-postgres-1'
        database = 'bobuy_reference_operator_probe'
        def docker(*args, data=None):
            return subprocess.run(['docker', 'exec', '-i', container, *args], input=data,
                                  check=True, capture_output=True)
        def sql(statement):
            return docker('psql', '-X', '-U', 'bobuy', '-d', database, '-qAt', '-v', 'ON_ERROR_STOP=1',
                          data=statement.encode()).stdout.decode().strip()
        docker('createdb', '-U', 'bobuy', database)
        try:
            sql("CREATE TABLE bb_business_probe(id integer PRIMARY KEY, value text); INSERT INTO bb_business_probe VALUES(1,'preserved');")
            TEMP.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=TEMP) as temp:
                stage = Path(temp)
                path, sha, _ = prepare(stage)
                def execute(statement):
                    # Insert a local-only synchronization sleep inside the real transaction.
                    held = "SET application_name='bobuy_reference_probe';\n" + statement.replace(
                        'BEGIN;', 'BEGIN; SELECT pg_sleep(3);', 1)
                    with ThreadPoolExecutor(max_workers=1) as pool:
                        imported = pool.submit(sql, held)
                        for _ in range(30):
                            if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='bobuy_reference_probe' AND wait_event='PgSleep'") == '1':
                                break
                            time.sleep(.1)
                        else:
                            self.fail('Import transaction did not reach synchronization point')
                        sql("SET statement_timeout='1s'; INSERT INTO bb_business_probe VALUES(2,'live');")
                        self.assertFalse(imported.done(), 'Writer must finish while import is still active')
                        imported.result(timeout=15)
                with patch.object(reference, 'run_sql', side_effect=execute):
                    reference.execute_reference_import(stage, path, sha)
                self.assertEqual(sql('SELECT count(*) FROM bb_reference_probe'), '2')
                with tempfile.TemporaryDirectory(dir=TEMP) as repeat:
                    p, h, _ = prepare(Path(repeat))
                    with patch.object(reference, 'run_sql', side_effect=sql):
                        reference.execute_reference_import(Path(repeat), p, h)
                self.assertEqual(sql('SELECT count(*) FROM bb_reference_probe'), '2')
                with tempfile.TemporaryDirectory(dir=TEMP) as failed:
                    p, h, _ = prepare(Path(failed), sql="INSERT INTO bb_reference_probe VALUES('BAD',NULL) ON CONFLICT DO NOTHING;", expected='999')
                    with patch.object(reference, 'run_sql', side_effect=sql):
                        with self.assertRaises(RuntimeError):
                            reference.execute_reference_import(Path(failed), p, h)
                self.assertEqual(sql("SELECT count(*) FROM bb_reference_probe WHERE code='BAD'"), '0')
                self.assertEqual(sql("SELECT string_agg(value,',' ORDER BY id) FROM bb_business_probe"), 'preserved,live')
                # The actual 2208-row shipped migration also works twice through this executor.
                migration = (ROOT / 'backend/src/main/resources/db/migration/V34__geographic_master.sql').read_text(encoding='utf-8')
                for _ in range(2):
                    with tempfile.TemporaryDirectory(dir=TEMP) as exact:
                        p, h, _ = prepare(Path(exact), sql=migration, query='SELECT count(*) FROM bb_geographic_area',
                                          expected='2208', table='bb_geographic_area')
                        with patch.object(reference, 'run_sql', side_effect=sql):
                            reference.execute_reference_import(Path(exact), p, h)
                self.assertEqual(sql("SELECT count(*) FROM bb_geographic_area WHERE level=1"), '249')
                self.assertEqual(sql("SELECT count(*) FROM bb_geographic_area WHERE level=2"), '47')
                self.assertEqual(sql("SELECT count(*) FROM bb_geographic_area WHERE level=3"), '1912')
        finally:
            docker('dropdb', '-U', 'bobuy', database)


if __name__ == '__main__':
    unittest.main()
