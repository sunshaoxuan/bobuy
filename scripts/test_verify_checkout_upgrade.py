"""No database/JVM calls: negative guards and preservation comparator only."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('checkout_upgrade', Path(__file__).with_name('verify-checkout-upgrade.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CheckoutUpgradeGuardTest(unittest.TestCase):
    def setUp(self):
        self.env = {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_JOB': 'postgres-migration-verify', 'BOBBUY_ISOLATED_CI_POSTGRES': 'true'}
        self.old = [{'table_name': 'bb_order_header', 'column_name': 'id'}]
        self.added = [{'table_name': 'bb_order_header', 'column_name': 'delivery_snapshot', 'data_type': 'jsonb', 'udt_name': 'jsonb', 'character_maximum_length': None, 'is_nullable': 'YES', 'column_default': None},
                      {'table_name': 'bb_order_header', 'column_name': 'checkout_payload_hash', 'data_type': 'character varying', 'udt_name': 'varchar', 'character_maximum_length': 64, 'is_nullable': 'YES', 'column_default': None}]
        self.rows = {'bb_order_header': '1:original-values'}

    def test_only_fixed_explicit_ci_identity_is_permitted(self):
        module.require_isolated_ci(self.env)
        for key in self.env:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                module.require_isolated_ci({**self.env, key: 'wrong'})
        self.assertEqual(module.URL, 'jdbc:postgresql://127.0.0.1:5432/bobbuy')

    def test_ordinary_execution_stops_before_any_connection_or_command(self):
        with patch.dict(module.os.environ, {}, clear=True), patch.object(module, 'command') as command:
            with self.assertRaises(RuntimeError):
                module.main()
            command.assert_not_called()

    def test_unchanged_old_columns_and_rows_with_nullable_new_facts_pass(self):
        module.assert_preserved(self.old, self.old + self.added, self.rows, self.rows)

    def test_row_loss_or_rewrite_never_passes(self):
        for rows in [{}, {'bb_order_header': '0:empty'}, {'bb_order_header': '1:changed'}]:
            with self.subTest(rows=rows), self.assertRaises(RuntimeError):
                module.assert_preserved(self.old, self.old + self.added, self.rows, rows)

    def test_changed_old_schema_or_new_defaults_types_and_not_null_reject(self):
        for key, value in [('is_nullable', 'NO'), ('column_default', '0'), ('data_type', 'text'), ('table_name', 'other')]:
            changed = copy.deepcopy(self.added)
            changed[0][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                module.assert_preserved(self.old, self.old + changed, self.rows, self.rows)
        with self.assertRaises(RuntimeError):
            module.assert_preserved(self.old, self.added, self.rows, self.rows)

    def test_projection_is_explicitly_the_old_columns(self):
        with patch.object(module, 'sql', return_value='1:hash') as sql:
            self.assertEqual(module.fingerprints([{'table_name': 'bb_order_header', 'column_name': 'lines'}]), {'bb_order_header': '1:hash'})
            self.assertIn('SELECT "lines" FROM "bb_order_header"', sql.call_args.args[0])
            self.assertNotIn('SELECT *', sql.call_args.args[0])
        with patch.object(module, 'sql') as sql, self.assertRaises(RuntimeError):
            module.fingerprints([{'table_name': 'bad;table', 'column_name': 'lines'}])
        sql.assert_not_called()
