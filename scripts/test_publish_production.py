import unittest

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


if __name__ == '__main__':
    unittest.main()
