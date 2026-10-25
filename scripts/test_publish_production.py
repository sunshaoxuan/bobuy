import json
import unittest
from unittest.mock import patch
from tempfile import TemporaryDirectory

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


spec = spec_from_file_location('publisher', Path(__file__).with_name('publish-production.py'))
publisher = module_from_spec(spec)
spec.loader.exec_module(publisher)


class RestoredDatabaseValidationTest(unittest.TestCase):
    def test_fingerprint_reparses_checks_and_ignores_physical_column_positions(self):
        constraints = [{'relation': 'bb_trip', 'conname': 'status_check', 'contype': 'c',
                        'definition': "CHECK (status = 'PUBLISHED')"}]
        with patch.object(publisher.subprocess, 'check_output', side_effect=[
                'flyway_schema_history', '1:rows', 'columns', 'indexes',
                json.dumps(constraints), "CHECK (status = 'PUBLISHED'::text)", 'sequences']) as query:
            result = publisher.database_fingerprint('restored_test')
        sql = [call.kwargs['input'] for call in query.call_args_list]
        self.assertNotIn('ordinal_position', sql[2])
        self.assertIn('column_default', sql[2])
        self.assertIn('BEGIN; CREATE TEMP TABLE', sql[5])
        self.assertIn('ROLLBACK;', sql[5])
        self.assertEqual(len(result['constraints']), 64)

    def test_accepts_matching_actual_snapshot(self):
        snapshot = {'bb_user': '7:hash', 'bb_trip': '2:hash', 'columns': 'schema'}
        publisher.validate_restored_database(snapshot, dict(snapshot))

    def test_rejects_changed_rows_schema_or_empty_snapshots(self):
        snapshot = {'bb_user': '7:hash', 'columns': 'schema', 'sequences': 'next'}
        for result in [{}, {'bb_user': '7:different', 'columns': 'schema', 'sequences': 'next'},
                       {**snapshot, 'columns': 'different'}, {**snapshot, 'sequences': 'changed'}]:
            with self.subTest(result=result), self.assertRaises(RuntimeError):
                publisher.validate_restored_database(snapshot, result)
        with self.assertRaises(RuntimeError):
            publisher.validate_restored_database({}, {})

    def test_write_freeze_replaces_only_the_api_upstream(self):
        config = Path(__file__).resolve().parents[1].joinpath('infra/nginx/bobuy.conf').read_text()
        frozen = publisher.maintenance_config(config)
        self.assertIn('Release maintenance in progress', frozen)
        self.assertIn('location /media/', frozen)
        self.assertIn('location = /api/auth/register-account', frozen)
        with self.assertRaises(RuntimeError):
            publisher.maintenance_config('location /api { return 200; }')

    def test_rollback_stops_writers_before_restoring_old_schema(self):
        task_directory = Path(__file__).resolve().parents[1] / '.task-tmp' / 'plan63'
        task_directory.mkdir(parents=True, exist_ok=True)
        with TemporaryDirectory(dir=task_directory) as temp:
            dump = Path(temp) / 'snapshot.dump'
            dump.write_bytes(b'test snapshot')
            with patch.object(publisher, 'run') as run:
                publisher.restore_database(['compose'], dump)
                calls = run.call_args_list
                self.assertEqual(calls[0].args[:2], ('compose', 'stop'))
                self.assertIn('core-service', calls[0].args)
                self.assertIn('--clean --if-exists --exit-on-error', calls[1].args[-1])


if __name__ == '__main__':
    unittest.main()
