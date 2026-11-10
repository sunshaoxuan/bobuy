"""Pure guard/comparator/protocol checks only; never execute a database, Maven, JVM or Docker command."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('issue_date_upgrade', Path(__file__).with_name('verify-issue-date-upgrade.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
REAL_ROOT = module.ROOT


class IssueDateUpgradeGuardTest(unittest.TestCase):
    def setUp(self):
        self.env = {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_JOB': 'postgres-migration-verify', 'BOBBUY_ISOLATED_CI_POSTGRES': 'true'}
        self.old = [{'table_name': 'bb_recommendation_post', 'column_name': 'id', 'ordinal_position': 1}]
        self.added = [{'table_name': 'bb_recommendation_post', 'column_name': name, 'ordinal_position': n + 2,
                       'data_type': kind[0], 'udt_name': kind[1], 'character_maximum_length': kind[2], 'is_nullable': 'YES', 'column_default': None}
                      for n, (name, kind) in enumerate(module.TYPES.items())]
        self.rows = {'bb_recommendation_post': '1:retained-all-old-values'}
        self.indexes = [{'tablename': 'bb_recommendation_post', 'indexname': 'old', 'indexdef': 'OLD INDEX'}]
        self.constraints = [{'table_name': 'bb_recommendation_post', 'name': 'old', 'definition': 'OLD CHECK'}]
        self.added_constraint = {'table_name': 'bb_recommendation_post', 'name': module.CONSTRAINT, 'type': 'c', 'validated': True,
                                 'deferrable': False, 'deferred': False, 'definition': module.expected_constraint()}

    def check(self, columns=None, rows=None, indexes=None, constraints=None):
        module.assert_preserved(self.old, self.old + self.added if columns is None else columns,
                                self.rows, self.rows if rows is None else rows,
                                self.indexes, self.indexes if indexes is None else indexes,
                                self.constraints, self.constraints + [self.added_constraint] if constraints is None else constraints)

    def test_exact_existing_hosted_ci_identity_is_required(self):
        self.assertEqual(module.URL, 'jdbc:postgresql://127.0.0.1:5432/bobbuy')
        module.require_isolated_ci(self.env)
        for key in self.env:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                module.require_isolated_ci({**self.env, key: 'wrong'})

    def test_ordinary_execution_fails_before_even_input_or_database_access(self):
        with patch.dict(module.os.environ, {}, clear=True), patch.object(module, 'verify_migration_inputs') as inputs, patch.object(module, 'sql') as sql, patch.object(module, 'migrate') as migrate:
            with self.assertRaises(RuntimeError):
                module.main()
            inputs.assert_not_called(); sql.assert_not_called(); migrate.assert_not_called()

    def test_cleanup_is_also_guarded_before_any_proof_read_or_database_access(self):
        with patch.dict(module.os.environ, {}, clear=True), patch.object(module, 'fixture_state') as state, patch.object(module, 'sql') as sql:
            with self.assertRaises(RuntimeError):
                module.cleanup_own_fixture('not-present.json')
            state.assert_not_called(); sql.assert_not_called()

    def test_exact_nullable_five_columns_with_unchanged_old_projection_pass(self):
        self.check()

    def test_old_data_loss_or_rewrite_is_rejected(self):
        for rows in [{}, {'bb_recommendation_post': '0:empty'}, {'bb_recommendation_post': '1:changed'}]:
            with self.subTest(rows=rows), self.assertRaises(RuntimeError):
                self.check(rows=rows)

    def test_old_schema_new_default_not_null_type_count_or_order_drift_rejects(self):
        for key, value in [('table_name', 'other'), ('data_type', 'text'), ('is_nullable', 'NO'), ('column_default', 'CURRENT_DATE'), ('ordinal_position', 99)]:
            added = copy.deepcopy(self.added); added[0][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                self.check(columns=self.old + added)
        for columns in [self.added, self.old + self.added[:-1], self.old + self.added + [self.added[0]]]:
            with self.subTest(columns=columns), self.assertRaises(RuntimeError):
                self.check(columns=columns)

    def test_old_indexes_or_constraints_cannot_change_or_disappear(self):
        for indexes in [[], self.indexes + [{'indexname': 'unexpected'}]]:
            with self.subTest(indexes=indexes), self.assertRaises(RuntimeError):
                self.check(indexes=indexes)
        for constraints in [[self.added_constraint], self.constraints + [self.added_constraint, {'name': 'unexpected'}]]:
            with self.subTest(constraints=constraints), self.assertRaises(RuntimeError):
                self.check(constraints=constraints)

    def test_only_the_validated_nondeferrable_exact_new_check_is_accepted(self):
        for key, value in [('validated', False), ('deferrable', True), ('deferred', True), ('type', 'u'), ('table_name', 'wrong'),
                           ('definition', self.added_constraint['definition'].replace('issue_date IS NULL', 'issue_date IS NOT NULL', 1))]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                self.check(constraints=self.constraints + [{**self.added_constraint, key: value}])

    def test_constraint_normalization_handles_pg_trim_and_text_cast_only(self):
        expected = module.expected_constraint()
        self.assertEqual(module.normalized_constraint(expected), module.normalized_constraint(expected.replace('trim(issue_date_source_ref)', 'TRIM(BOTH FROM (issue_date_source_ref)::text)')))
        self.assertNotEqual(module.normalized_constraint(expected), module.normalized_constraint(expected.replace('> 0', '> 1')))

    def test_history_preserves_full_checksum_prefix_and_one_exact_28_1_suffix(self):
        before = [{'installed_rank': 27, 'version': '28', 'script': 'V28__checkout_delivery_snapshot.sql', 'checksum': 123, 'success': True}]
        suffix = {'installed_rank': 28, 'version': '28.1', 'script': module.MIGRATION,
                  'checksum': module.migration_checksum((REAL_ROOT / 'backend/src/main/resources/db/migration' / module.MIGRATION).read_bytes()), 'success': True}
        module.require_history(before, before + [suffix])
        cases = [[{**before[0], 'checksum': 999}, suffix], before, before + [suffix, suffix], before + [{**suffix, 'success': False}],
                 before + [{**suffix, 'version': '28'}], before + [{**suffix, 'installed_rank': 29}], before + [{**suffix, 'checksum': 1}]]
        for after in cases:
            with self.subTest(after=after), self.assertRaises(RuntimeError):
                module.require_history(before, after)

    def test_fixture_json_matches_real_picture_context_and_history_shapes(self):
        p = module.fixture_payloads()
        self.assertEqual(set(p['gallery'][0]), {'id', 'url', 'hash', 'sourceUrl', 'assetKey', 'label', 'verifiedAt'})
        self.assertEqual(set(p['context']), {'supplierKey', 'channel', 'variantKey', 'sourceMessageKey', 'sourceUrl', 'activityStart', 'activityEnd', 'activityApplies', 'windowEvidence', 'startSearchComplete'})
        self.assertEqual(set(p['article']), {'sourceLocale', 'title', 'body', 'translations'})
        self.assertEqual(set(p['quote']), {'name', 'itemNumber', 'productId', 'sourceImageHash', 'sourceImageUrl', 'referencePrice', 'originalPrice', 'discountAmount', 'priceUnit', 'offerStart', 'offerEnd', 'couponStart', 'couponEnd', 'offerNotes', 'context'})
        self.assertEqual(p['imageHash'], module.sha(p['png']))
        with patch.object(module, 'sql') as sql:
            module.seed_v28()
            statement = sql.call_args.args[0]
            self.assertIn('raw_sha256,byte_length', statement); self.assertIn("'[\"AGENT\"]'::jsonb", statement)
            self.assertNotIn('catalog_data', statement); self.assertNotIn('product_identities', statement)

    def test_failed_preservation_never_writes_pass_receipt(self):
        with tempfile.TemporaryDirectory(prefix='bobuy-issue-date-gate-') as temporary:
            root = Path(temporary); (root / 'backend/target').mkdir(parents=True)
            (root / 'backend/target/c2-upgrade-preservation.json').write_text('{}')
            state = {name: [{'id': n}] for n, name in enumerate(['bb_user', 'bb_recommendation_post', 'bb_recommendation_item', 'bb_recommendation_image', 'bb_recommendation_article_revision', 'bb_reference_quote_revision'])}
            with patch.dict(module.os.environ, self.env, clear=True), patch.object(module, 'ROOT', root), patch.object(module, 'verify_migration_inputs', return_value={}), patch.object(module, 'require_v28_history'), patch.object(module, 'seed_v28'), patch.object(module, 'history', return_value=[]), patch.object(module, 'columns', return_value=self.old), patch.object(module, 'indexes', return_value=self.indexes), patch.object(module, 'constraints', return_value=self.constraints), patch.object(module, 'fingerprints', return_value={f'table_{n}': 'retained' for n in range(38)}), patch.object(module, 'fixture_state', return_value=state), patch.object(module, 'migrate') as migrate, patch.object(module, 'assert_preserved', side_effect=RuntimeError('actual preservation mismatch')):
                with self.assertRaisesRegex(RuntimeError, 'actual preservation mismatch'):
                    module.main()
                migrate.assert_called_once_with('28.1')
                self.assertFalse((root / module.REPORT).exists())

    def test_checksum_ignores_line_endings_as_flyway_does(self):
        self.assertEqual(module.migration_checksum(b'one\ntwo\n'), module.migration_checksum(b'one\r\ntwo\r\n'))

    def test_pinned_input_inventory_rejects_unknown_or_changed_sql_without_db(self):
        with tempfile.TemporaryDirectory(prefix='bobuy-issue-sql-') as temporary:
            root = Path(temporary); migration_root = root / 'backend/src/main/resources/db/migration'; migration_root.mkdir(parents=True)
            rows = []
            for number in [n for n in range(1, 29) if n != 8]:
                content = f'-- synthetic SQL resource {number}\n'.encode(); name = f'V{number}__fixture.sql'; (migration_root / name).write_bytes(content)
                rows.append({'path': name, 'bytes': len(content), 'sha256': module.sha(content)})
            baseline = {'schemaBefore': 27, 'schemaAfter': 28, 'migrationChanges': True, 'migrations': rows}; raw = json.dumps(baseline).encode()
            path = root / module.BASELINE; path.parent.mkdir(parents=True); path.write_bytes(raw)
            (migration_root / module.MIGRATION).write_bytes((REAL_ROOT / 'backend/src/main/resources/db/migration' / module.MIGRATION).read_bytes())
            with patch.object(module, 'ROOT', root), patch.object(module, 'BASELINE_SHA256', module.sha(raw)):
                self.assertEqual(module.verify_migration_inputs(), baseline)
                future = migration_root / 'V31__recommendation_item_publication.sql'
                future.write_bytes((REAL_ROOT / 'backend/src/main/resources/db/migration' / future.name).read_bytes().replace(b'\r\n', b'\n'))
                self.assertEqual(module.verify_migration_inputs(), baseline)
                future.write_bytes(future.read_bytes() + b'\n-- changed future migration')
                with self.assertRaises(RuntimeError):
                    module.verify_migration_inputs()
                future.unlink()
                (migration_root / 'V29__unexpected.sql').write_text('-- unknown')
                with self.assertRaises(RuntimeError):
                    module.verify_migration_inputs()
                (migration_root / 'V29__unexpected.sql').unlink(); (migration_root / rows[0]['path']).write_text('-- drift')
                with self.assertRaises(RuntimeError):
                    module.verify_migration_inputs()
