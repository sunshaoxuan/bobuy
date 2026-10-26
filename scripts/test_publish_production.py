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
                publisher.restore_database(['compose'], dump,{'flyway_schema_history':'snapshot','bb_product':'snapshot'})
                calls = run.call_args_list
                self.assertEqual(calls[0].args[:2], ('compose', 'stop'))
                self.assertIn('core-service', calls[0].args)
                self.assertIn('ON_ERROR_STOP=1', calls[1].args[-1])
                self.assertIn("c.contype='f'", calls[1].kwargs['input'])
                self.assertNotIn('DROP TABLE', calls[1].kwargs['input'])
                self.assertIn('DROP TABLE public.%I CASCADE',calls[2].kwargs['input'])
                self.assertIn("'bb_product'",calls[2].kwargs['input'])
                self.assertIn('--clean --if-exists --exit-on-error', calls[3].args[-1])




class AdditiveContentMigrationTests(unittest.TestCase):
    def test_orders_frozen_before_v17_and_price_history_frozen_after_v17(self):
        tables=publisher.CONTENT_TABLES
        values=[]
        for table in tables:
            values.extend(['id','1:hash'] if table!='bb_product_price_adjustment' else [''])
        with patch.object(publisher.subprocess,'check_output',side_effect=values):
            before=publisher.content_fingerprint()
        self.assertIn('bb_order_header',before)
        self.assertNotIn('bb_product_price_adjustment',before)
        with patch.object(publisher.subprocess,'check_output',side_effect=['1:hash']*len(before)):
            self.assertEqual(publisher.content_fingerprint(before),before)
        with patch.object(publisher.subprocess,'check_output',side_effect=['id','1:hash']*len(tables)):
            after=publisher.content_fingerprint()
        self.assertIn('bb_product_price_adjustment',after)
        with self.assertRaises(ValueError):publisher.content_fingerprint({})
    def test_projection_freezes_all_old_columns_without_new_defaults(self):
        query=publisher.content_projection_query('bb_recommendation_item',['id','name','offer_notes'])
        self.assertIn("'id',t.\"id\"",query)
        self.assertIn("'offer_notes',t.\"offer_notes\"",query)
        self.assertNotIn('translations',query)
        self.assertIn('count(*)',query)
        self.assertIn('order by v',query)

    def test_invalid_projection_and_content_mutation_fail_closed(self):
        for table,columns in [('private_table',['id']),('bb_product',[]),('bb_product',['id','id'])]:
            with self.assertRaises(ValueError):publisher.content_projection_query(table,columns)
        before={'bb_product':{'columns':['id','base_price'],'fingerprint':'1:abc'}}
        with self.assertRaises(RuntimeError):publisher.validate_restored_database(before,{'bb_product':{'columns':['id','base_price'],'fingerprint':'1:def'}})

class RollbackAddedTableInventoryTest(unittest.TestCase):
    def test_missing_inventory_fails_before_stopping_writers(self):
        with patch.object(publisher,'run') as run:
            for snapshot in [{},{'columns':'x'},{'flyway_schema_history':'x'},{'flyway_schema_history':'x','malicious;name':'x'}]:
                with self.assertRaises(ValueError):publisher.restore_database(['compose'],Path('unused.dump'),snapshot)
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
