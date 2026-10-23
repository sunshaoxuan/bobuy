import unittest
from unittest.mock import patch
from tempfile import TemporaryDirectory

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


spec = spec_from_file_location('publisher', Path(__file__).with_name('publish-production.py'))
publisher = module_from_spec(spec)
spec.loader.exec_module(publisher)


class RestoredDatabaseValidationTest(unittest.TestCase):
    def test_accepts_existing_v4_pilot_backup(self):
        publisher.validate_restored_database('1\n0\n1,2,3,4\n3\n')

    def test_rejects_unexpected_data_or_missing_migration_structure(self):
        for result in ['2\n0\n1,2,3,4\n3', '1\n1\n1,2,3,4\n3',
                       '1\n0\n1,2,3\n3', '1\n0\n1,2,3,4\n2']:
            with self.subTest(result=result), self.assertRaises(RuntimeError):
                publisher.validate_restored_database(result)

    def test_write_freeze_replaces_only_the_api_upstream(self):
        config = Path(__file__).resolve().parents[1].joinpath('infra/nginx/bobuy.conf').read_text()
        frozen = publisher.maintenance_config(config)
        self.assertIn('Release maintenance in progress', frozen)
        self.assertIn('location /media/', frozen)
        self.assertIn('location = /api/auth/register-account', frozen)
        with self.assertRaises(RuntimeError):
            publisher.maintenance_config('location /api { return 200; }')

    def test_rollback_stops_writers_before_restoring_old_schema(self):
        with TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / '.task-tmp' / 'plan61') as temp:
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
